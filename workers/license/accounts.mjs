import { scrypt, timingSafeEqual } from 'node:crypto';

const encoder = new TextEncoder();
const lifetime = 7 * 86400;
const opaque = /^[A-Za-z0-9_-]{43}$/;
const passwordFormat = /^scrypt-v1\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/;
function random(h, length = 32) { return h.base64url(crypto.getRandomValues(new Uint8Array(length))); }
function emailAddress(value, h) {
    h.requireValue(typeof value === 'string' && value.trim().length <= 254 && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value.trim()), 400, 'invalid_email', '请填写有效的邮箱地址。');
    return value.trim().toLowerCase();
}
function password(value, h) {
    h.requireValue(typeof value === 'string' && [...value].length >= 15 && [...value].length <= 128 && encoder.encode(value).length <= 512, 400, 'invalid_password', '密码需要 15–128 个字符，可以使用一句好记的话。');
    return value;
}
async function hashPassword(value, salt, env, h) {
    // OWASP scrypt N=2^14,r=8,p=5: 16 MiB rather than exhausting a Worker isolate.
    const peppered = await h.hmac(env.ACCOUNT_SECRET, 'password-v1:' + value);
    const derived = await new Promise((resolve, reject) => scrypt(peppered, salt, 32, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
    return 'scrypt-v1$' + salt + '$' + h.base64url(derived);
}
async function checkPassword(value, saved, env, h) {
    const match = passwordFormat.exec(saved || '');
    // Missing users still incur the same work; no account enumeration by fast failures.
    const actual = await hashPassword(value, match?.[1] || 'AAAAAAAAAAAAAAAAAAAAAA', env, h);
    return !!match && timingSafeEqual(encoder.encode(actual), encoder.encode(saved));
}
function originFor(request, env, h) {
    let url; try { url = new URL(env.PUBLIC_ORIGIN); } catch { /* rejected below */ }
    h.requireValue(url && !url.username && !url.password && url.pathname === '/' && !url.hash && !url.search && (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) && new URL(request.url).origin === url.origin, 503, 'account_origin_unavailable', '账号服务来源尚未配置。');
    return url;
}
function cookieName(origin) { return origin.protocol === 'https:' ? '__Host-bynd_account' : 'bynd_account_local'; }
function cookieValue(request, origin) {
    const cookies = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).filter(x => x.startsWith(cookieName(origin) + '='));
    return cookies.length === 1 ? cookies[0].slice(cookieName(origin).length + 1) : '';
}
function withCookie(response, origin, token, age = lifetime) {
    response.headers.set('Set-Cookie', cookieName(origin) + '=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + age + (origin.protocol === 'https:' ? '; Secure' : ''));
    return response;
}
async function session(request, env, now, origin, h, required = true) {
    const token = cookieValue(request, origin);
    const hash = opaque.test(token) ? await h.digest(encoder.encode(token)) : '';
    const row = hash && await env.DB.prepare(`SELECT a.id,a.email,a.display_name,a.password_revision,s.token_hash FROM account_sessions s JOIN accounts a ON a.id=s.user_id
        WHERE s.token_hash=? AND s.expires_at>? AND s.password_revision=a.password_revision`).bind(hash, now).first();
    if (required) h.requireValue(row, 401, 'login_required', '请先登录你的 BYND 账号。');
    return row || null;
}
async function throttle(request, env, now, label, email, h) {
    h.requireValue(env.ACCOUNT_RATE_LIMITER, 503, 'account_limiter_unavailable', '账号服务尚未配置。');
    const limited = await env.ACCOUNT_RATE_LIMITER.limit({ key: label + ':' + (request.headers.get('CF-Connecting-IP') || 'unknown') });
    h.requireValue(limited.success, 429, 'account_rate_limit', '操作太频繁，请稍后重试。');
    // A database counter also limits distributed guesses against a single email/account.
    const key = h.base64url(await h.hmac(env.ACCOUNT_SECRET, 'throttle:' + label + ':' + email));
    await env.DB.prepare(`INSERT INTO account_throttle (key_hash,window_start,attempts) VALUES (?,?,1)
        ON CONFLICT(key_hash) DO UPDATE SET window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END,
        attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END`).bind(key, now, now - 600, now - 600).run();
    const row = await env.DB.prepare('SELECT attempts FROM account_throttle WHERE key_hash=?').bind(key).first();
    h.requireValue(row.attempts <= (label === 'login' ? 10 : 5), 429, 'account_rate_limit', '操作太频繁，请十分钟后再试。');
}
function mailMode(env, origin, h) {
    if (env.ACCOUNT_DEV_MAIL && origin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) return 'local';
    h.requireValue(env.EMAIL_ENABLED === 'true' && env.RESEND_API_KEY && /^[^\r\n]+@[^\r\n]+$/.test(env.EMAIL_FROM || ''), 503, 'account_email_unavailable', '邮箱服务尚未配置，暂时无法注册或找回密码。');
    return 'email';
}
async function sendMail(env, mode, recipient, purpose, link, id, h) {
    const subject = purpose === 'register' ? '欢迎来到 BYND · 验证邮箱' : 'BYND · 重设密码';
    const text = (purpose === 'register' ? '只有你本人提交了注册，才请打开链接，确认创建你的账号：' : '如果你申请了重设密码，请打开链接设置新密码：') + '\n\n' + link + '\n\n链接 20 分钟内有效，只能使用一次。请不要转发。没有申请的话，忽略这封邮件即可。';
    if (mode === 'local') { await env.ACCOUNT_DEV_MAIL.send({ to: recipient, subject, text, link, purpose }); return; }
    let result;
    try {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000),
            headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'bynd-account-' + id },
            body: JSON.stringify({ from: env.EMAIL_FROM, to: [recipient], subject, text }) });
        result = response.ok && await h.readBody(response);
    } catch { /* Do not claim delivery after a provider/network error. */ }
    h.requireValue(result && typeof result.id === 'string' && result.id.length <= 200, 503, 'account_email_failed', '邮件未确认发送，请稍后重新申请。');
}
async function cleanup(env, now) {
    await env.DB.batch([
        env.DB.prepare('DELETE FROM account_tokens WHERE expires_at<=? OR used_at IS NOT NULL').bind(now),
        env.DB.prepare('DELETE FROM account_sessions WHERE expires_at<=?').bind(now),
        env.DB.prepare('DELETE FROM account_throttle WHERE window_start<=?').bind(now - 86400)
    ]);
}
export async function handleAccounts(request, env, now, h) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith('/account/v1/')) return null;
    const origin = originFor(request, env, h);
    h.requireValue(env.ACCOUNTS_ENABLED === 'true' && typeof env.ACCOUNT_SECRET === 'string' && env.ACCOUNT_SECRET.length >= 32, 503, 'accounts_unavailable', '账号服务尚未开放，请稍后再来。');
    const isPost = request.method === 'POST';
    if (isPost) h.requireValue(request.headers.get('origin') === origin.origin && request.headers.get('X-BYND-Account') === '1', 403, 'account_origin_rejected', '请从 BYND 官网操作。');
    const view = row => row ? { id: row.id, email: row.email, displayName: row.display_name } : null;
    if (path === '/account/v1/me' && request.method === 'GET') return h.json({ user: view(await session(request, env, now, origin, h, false)), mailMode: env.ACCOUNT_DEV_MAIL && origin.protocol === 'http:' ? 'local' : 'email' });
    if (path === '/account/v1/licenses' && request.method === 'GET') {
        const user = await session(request, env, now, origin, h);
        const rows = (await env.DB.prepare(`SELECT l.id,l.key_hint,l.status,l.created_at,l.activated_at FROM licenses l JOIN account_licenses a ON a.license_id=l.id WHERE a.user_id=? ORDER BY a.claimed_at DESC LIMIT 100`).bind(user.id).all()).results;
        return h.json({ licenses: rows });
    }
    const reveal = /^\/account\/v1\/licenses\/([0-9a-f-]{36})\/code$/.exec(path);
    if (reveal && isPost) {
        const user = await session(request, env, now, origin, h);
        const license = await env.DB.prepare('SELECT l.* FROM licenses l JOIN account_licenses a ON a.license_id=l.id WHERE l.id=? AND a.user_id=?').bind(reveal[1], user.id).first();
        h.requireValue(license && license.status === 'active', 404, 'license_unavailable', '授权不存在或已停用。');
        const code = await h.issuedKey(env, license.id);
        h.requireValue(await h.keyHash(env, code) === license.key_hash, 503, 'issuer_mismatch', '授权签发配置不一致，请联系支持。');
        return h.json({ licenseKey: code });
    }
    h.requireValue(isPost, 404, 'not_found', '接口不存在。');
    const body = await h.readBody(request);
    if (path === '/account/v1/logout') {
        const token = cookieValue(request, origin);
        if (opaque.test(token)) await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await h.digest(encoder.encode(token))).run();
        return withCookie(h.json({ ok: true }), origin, '', 0);
    }
    if (path === '/account/v1/register' || path === '/account/v1/forgot') {
        const email = emailAddress(body.email, h), purpose = path.endsWith('/register') ? 'register' : 'reset';
        const mode = mailMode(env, origin, h);
        await throttle(request, env, now, purpose, email, h);
        const existing = await env.DB.prepare('SELECT id,password_revision FROM accounts WHERE email=?').bind(email).first();
        let savedHash = null, name = null, licenseId = null;
        if (purpose === 'register') {
            name = typeof body.displayName === 'string' ? body.displayName.trim() : '';
            h.requireValue(name.length >= 1 && [...name].length <= 40 && !/[\x00-\x1f\x7f]/.test(name), 400, 'invalid_name', '称呼需要 1–40 个字符。');
            if (body.licenseKey !== undefined && body.licenseKey !== '') {
                h.requireValue(typeof body.licenseKey === 'string' && body.licenseKey.length <= 80, 400, 'invalid_key', '请检查激活码格式。');
                if (body.licenseKey.trim()) {
                    const key = await h.keyHash(env, body.licenseKey);
                    const license = await env.DB.prepare("SELECT l.id FROM licenses l WHERE l.key_hash=? AND l.status='active' AND NOT EXISTS (SELECT 1 FROM account_licenses a WHERE a.license_id=l.id)").bind(key).first();
                    h.requireValue(license, 409, 'registration_license_unavailable', '激活码无效、已停用或已保存到其他账号，请检查后重试。');
                    licenseId = license.id;
                }
            }
            savedHash = await hashPassword(password(body.password, h), random(h, 16), env, h);
        }
        await cleanup(env, now);
        // Registration never overwrites an existing password. Unknown reset emails reveal nothing.
        if ((purpose === 'register' && !existing) || (purpose === 'reset' && existing)) {
            const token = random(h), hash = await h.digest(encoder.encode(token));
            await env.DB.prepare('INSERT INTO account_tokens (token_hash,purpose,email,display_name,password_hash,user_id,password_revision,created_at,expires_at,register_license_id) VALUES (?,?,?,?,?,?,?,?,?,?)')
                .bind(hash, purpose, email, name, savedHash, existing?.id || null, existing?.password_revision ?? null, now, now + 1200, licenseId).run();
            await sendMail(env, mode, email, purpose, origin.origin + '/account.html#' + purpose + '=' + token, hash, h);
        }
        return h.json({ ok: true, mailMode: mode, message: purpose === 'register' ? '如果邮箱尚未注册，验证链接已提交发送。已有账号请直接登录或找回密码。' : '如果邮箱已注册，重设链接已提交发送，请查看邮箱。' });
    }
    if (path === '/account/v1/verify' || path === '/account/v1/reset') {
        h.requireValue(opaque.test(body.token || ''), 400, 'invalid_account_token', '验证链接无效或已过期，请重新申请。');
        await throttle(request, env, now, 'token', request.headers.get('CF-Connecting-IP') || 'unknown', h);
        const hash = await h.digest(encoder.encode(body.token)), purpose = path.endsWith('/verify') ? 'register' : 'reset';
        const pending = await env.DB.prepare('SELECT * FROM account_tokens WHERE token_hash=? AND purpose=? AND expires_at>? AND used_at IS NULL').bind(hash, purpose, now).first();
        h.requireValue(pending, 400, 'invalid_account_token', '验证链接无效或已过期，请重新申请。');
        if (purpose === 'register') {
            const id = crypto.randomUUID();
            const results = await env.DB.batch([
                env.DB.prepare(`UPDATE account_tokens SET used_at=? WHERE token_hash=? AND purpose='register' AND used_at IS NULL AND expires_at>?
                    AND NOT EXISTS (SELECT 1 FROM accounts WHERE email=account_tokens.email)
                    AND (register_license_id IS NULL OR EXISTS (SELECT 1 FROM licenses l WHERE l.id=register_license_id AND l.status='active' AND NOT EXISTS (SELECT 1 FROM account_licenses a WHERE a.license_id=l.id)))`).bind(now, hash, now),
                env.DB.prepare('INSERT INTO accounts (id,email,display_name,password_hash,created_at,verified_at) SELECT ?,?,?,?,?,? WHERE changes()=1 ON CONFLICT(email) DO NOTHING')
                    .bind(id, pending.email, pending.display_name, pending.password_hash, now, now),
                env.DB.prepare('INSERT INTO account_licenses (license_id,user_id,claimed_at) SELECT ?,?,? WHERE ? IS NOT NULL AND changes()=1')
                    .bind(pending.register_license_id, id, now, pending.register_license_id)
            ]);
            if (results[1].meta.changes !== 1) {
                const existing = await env.DB.prepare('SELECT id FROM accounts WHERE email=?').bind(pending.email).first();
                h.requireValue(false, 409, existing ? 'account_exists' : 'registration_license_unavailable', existing ? '邮箱已验证或已注册，请登录或找回密码。' : '激活码状态已变化，账号没有创建，请检查激活码后重新注册。');
            }
            return h.json({ ok: true, message: pending.register_license_id ? '邮箱验证成功，激活码已保存到你的账号，可以登录啦。' : '邮箱验证成功，可以登录啦。' });
        }
        const savedHash = await hashPassword(password(body.password, h), random(h, 16), env, h);
        const results = await env.DB.batch([
            env.DB.prepare("UPDATE account_tokens SET used_at=? WHERE token_hash=? AND purpose='reset' AND used_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM accounts WHERE id=? AND password_revision=?)").bind(now, hash, now, pending.user_id, pending.password_revision),
            env.DB.prepare('UPDATE accounts SET password_hash=?,password_revision=password_revision+1 WHERE id=? AND password_revision=? AND changes()=1').bind(savedHash, pending.user_id, pending.password_revision),
            env.DB.prepare('DELETE FROM account_sessions WHERE user_id=? AND password_revision<> (SELECT password_revision FROM accounts WHERE id=?)').bind(pending.user_id, pending.user_id)
        ]);
        h.requireValue(results[1].meta.changes === 1, 400, 'invalid_account_token', '验证链接已失效，请重新申请。');
        return withCookie(h.json({ ok: true, message: '密码已重设，请用新密码登录。其他设备的登录已退出。' }), origin, '', 0);
    }
    if (path === '/account/v1/login') {
        const email = emailAddress(body.email, h);
        h.requireValue(typeof body.password === 'string' && encoder.encode(body.password).length <= 512, 400, 'invalid_password', '请填写密码。');
        await throttle(request, env, now, 'login', email, h);
        const user = await env.DB.prepare('SELECT * FROM accounts WHERE email=?').bind(email).first();
        h.requireValue(await checkPassword(body.password, user?.password_hash, env, h), 401, 'login_failed', '邮箱或密码不正确；新账号请先验证邮箱。');
        const token = random(h), hash = await h.digest(encoder.encode(token));
        const oldToken = cookieValue(request, origin);
        const result = await env.DB.batch([
            env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=? OR expires_at<=?').bind(opaque.test(oldToken) ? await h.digest(encoder.encode(oldToken)) : '', now),
            // Concurrent password resets cannot create a session with the old password revision.
            env.DB.prepare('INSERT INTO account_sessions (token_hash,user_id,password_revision,created_at,expires_at) SELECT ?,id,password_revision,?,? FROM accounts WHERE id=? AND password_revision=?').bind(hash, now, now + lifetime, user.id, user.password_revision)
        ]);
        h.requireValue(result[1].meta.changes === 1, 401, 'login_failed', '登录状态已变化，请重新登录。');
        return withCookie(h.json({ user: view(user) }), origin, token);
    }
    if (path === '/account/v1/claim') {
        const user = await session(request, env, now, origin, h);
        await throttle(request, env, now, 'claim', user.id, h);
        const hash = await h.keyHash(env, body.licenseKey);
        const row = await env.DB.prepare('SELECT id,status FROM licenses WHERE key_hash=?').bind(hash).first();
        h.requireValue(row && row.status === 'active', 404, 'license_unavailable', '激活码不存在或已停用，请检查后重试。');
        await env.DB.prepare("INSERT INTO account_licenses (license_id,user_id,claimed_at) SELECT id,?,? FROM licenses WHERE id=? AND status='active' ON CONFLICT(license_id) DO NOTHING").bind(user.id, now, row.id).run();
        const saved = await env.DB.prepare('SELECT user_id FROM account_licenses WHERE license_id=?').bind(row.id).first();
        h.requireValue(saved?.user_id === user.id, 409, 'license_already_claimed', '这份授权已保存到其他账号，请联系支持。');
        return h.json({ ok: true, message: '授权已保存，以后登录就能找回。' });
    }
    h.requireValue(false, 404, 'not_found', '接口不存在。');
}
