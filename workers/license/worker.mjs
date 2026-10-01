const PRODUCT = 'cc.ccwu.bynd';
const encoder = new TextEncoder();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class HttpError extends Error {
    constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function requireValue(condition, status, code, message) {
    if (!condition) throw new HttpError(status, code, message);
}
export function base64url(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
export function unbase64url(value) {
    requireValue(typeof value === 'string' && value.length <= 8192 && /^[A-Za-z0-9_-]+$/.test(value), 400, 'invalid_encoding', '编码无效。');
    return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
export async function digest(bytes) { return base64url(await crypto.subtle.digest('SHA-256', bytes)); }
async function hmac(secret, value) {
    requireValue(typeof secret === 'string' && secret.length >= 32, 503, 'issuer_unavailable', '签发服务尚未配置。');
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
export function normalizeKey(value) {
    const key = String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
    requireValue(/^BYND[0-9A-F]{32}$/.test(key), 400, 'invalid_key', '请检查激活码格式。');
    return key;
}
async function keyHash(env, value) { return base64url(await hmac(env.LICENSE_KEY_SECRET, 'lookup:' + normalizeKey(value))); }
async function issuedKey(env, id) {
    const bytes = (await hmac(env.LICENSE_KEY_SECRET, 'issue:' + id)).slice(0, 16);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return 'BYND-' + hex.match(/.{4}/g).join('-');
}
export async function signToken(env, type, payload) {
    requireValue(env.SIGNING_PRIVATE_JWK && /^[A-Za-z0-9_-]{1,64}$/.test(env.SIGNING_KEY_ID || ''), 503, 'signing_unavailable', '签名服务尚未配置。');
    const key = await crypto.subtle.importKey('jwk', JSON.parse(env.SIGNING_PRIVATE_JWK), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const header = base64url(encoder.encode(JSON.stringify({ alg: 'RS256', typ: type, kid: env.SIGNING_KEY_ID })));
    const body = base64url(encoder.encode(JSON.stringify(payload)));
    const data = header + '.' + body;
    return data + '.' + base64url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(data)));
}
function json(payload, status = 200) {
    return new Response(payload === null ? null : JSON.stringify(payload), { status, headers: {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
    } });
}
async function readBody(request) {
    requireValue((request.headers.get('content-type') || '').split(';')[0].trim() === 'application/json', 415, 'json_required', '请使用 JSON 请求。');
    // Count the streamed bytes, including requests without Content-Length.
    const reader = request.body?.getReader();
    requireValue(reader, 400, 'invalid_json', '请求为空。');
    let size = 0, parts = [];
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32768) { await reader.cancel(); throw new HttpError(413, 'body_too_large', '请求过大。'); }
        parts.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    let data;
    try { data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new HttpError(400, 'invalid_json', 'JSON 格式无效。'); }
    requireValue(data && typeof data === 'object' && !Array.isArray(data), 400, 'invalid_json', '请求必须是对象。');
    return data;
}
async function authenticate(request, env) {
    requireValue(typeof env.ADMIN_TOKEN === 'string' && env.ADMIN_TOKEN.length >= 32, 503, 'admin_unavailable', '管理服务尚未配置。');
    const supplied = request.headers.get('authorization') || '';
    const left = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(supplied)));
    const right = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode('Bearer ' + env.ADMIN_TOKEN)));
    let mismatch = 0;
    for (let i = 0; i < left.length; i++) mismatch |= left[i] ^ right[i];
    requireValue(mismatch === 0, 401, 'unauthorized', '管理身份验证失败。');
}
async function activationAllowed(request, env) {
    requireValue(env.LICENSE_ACTIVATION_ENABLED === 'true', 503, 'not_on_sale', 'BYND 尚未开放公众激活，当前开发版本无需激活。');
    requireValue(env.ACTIVATION_RATE_LIMITER, 503, 'limiter_unavailable', '激活服务尚未配置。');
    const result = await env.ACTIVATION_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
    requireValue(result.success, 429, 'rate_limited', '请求过于频繁，请一分钟后重试。');
}
async function deviceKey(spki) {
    const bytes = unbase64url(spki);
    requireValue(bytes.length >= 256 && bytes.length <= 1024, 400, 'invalid_device', '设备密钥无效。');
    let key;
    try { key = await crypto.subtle.importKey('spki', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']); }
    catch { throw new HttpError(400, 'invalid_device', '设备密钥无效。'); }
    requireValue(key.algorithm.modulusLength >= 2048, 400, 'invalid_device', '设备密钥长度不足。');
    return { key, device: await digest(bytes) };
}
async function challenge(request, env, now) {
    await activationAllowed(request, env);
    const body = await readBody(request), hash = await keyHash(env, body.licenseKey);
    const { device } = await deviceKey(body.publicKey);
    const id = crypto.randomUUID();
    const text = `${PRODUCT}\n${hash}\n${device}\n${id}`;
    await env.DB.batch([
        env.DB.prepare('DELETE FROM challenges WHERE expires_at <= ?').bind(now),
        env.DB.prepare('INSERT INTO challenges (id,key_hash,device,challenge,expires_at) VALUES (?,?,?,?,?)').bind(id, hash, device, text, now + 300)
    ]);
    // Unknown codes receive the same challenge response; activation decides validity.
    return json({ challengeId: id, challenge: text, expiresAt: now + 300 });
}
async function activate(request, env, now) {
    await activationAllowed(request, env);
    const body = await readBody(request), hash = await keyHash(env, body.licenseKey);
    const { key, device } = await deviceKey(body.publicKey);
    const nonce = await env.DB.prepare('SELECT * FROM challenges WHERE id = ?').bind(String(body.challengeId || '')).first();
    requireValue(nonce && !nonce.consumed_by && nonce.expires_at > now && nonce.key_hash === hash && nonce.device === device, 409, 'challenge_expired', '激活请求已过期，请重试。');
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unbase64url(body.proof), encoder.encode(nonce.challenge));
    requireValue(valid, 403, 'invalid_proof', '设备身份验证失败。');
    const license = await env.DB.prepare('SELECT * FROM licenses WHERE key_hash = ?').bind(hash).first();
    requireValue(license && license.status === 'active', 403, 'license_unavailable', '激活码无效或已停用。');
    requireValue(!license.bound_device || license.bound_device === device, 409, 'device_limit', '激活码已绑定其他设备，请联系支持办理换机。');
    const attempt = crypto.randomUUID();
    // Sign before changing the binding; missing/broken signing secrets cannot consume a seat.
    const token = await signToken(env, 'BYND-LICENSE', {
        iss: 'bynd-license', aud: PRODUCT, licenseId: license.id, device,
        entitlement: 'perpetual', iat: now, revision: license.revision
    });
    const result = await env.DB.batch([
        env.DB.prepare('UPDATE challenges SET consumed_by = ? WHERE id = ? AND consumed_by IS NULL AND expires_at > ?').bind(attempt, nonce.id, now),
        env.DB.prepare(`UPDATE licenses SET bound_device = ?, activated_at = COALESCE(activated_at, ?)
            WHERE id = ? AND status = 'active' AND revision = ? AND (bound_device IS NULL OR bound_device = ?)
            AND EXISTS (SELECT 1 FROM challenges WHERE id = ? AND consumed_by = ?)`).bind(device, now, license.id, license.revision, device, nonce.id, attempt),
        env.DB.prepare(`INSERT INTO audit_logs (id,license_id,action,device,created_at)
            SELECT ?,id,'activate',?,? FROM licenses WHERE id = ? AND status = 'active' AND revision = ? AND bound_device = ?
            AND EXISTS (SELECT 1 FROM challenges WHERE id = ? AND consumed_by = ?)`).bind(attempt, device, now, license.id, license.revision, device, nonce.id, attempt)
    ]);
    requireValue(result[0].meta.changes === 1 && result[1].meta.changes === 1, 409, 'activation_conflict', '设备绑定状态已变化，请重试。');
    return json({ token });
}
async function createLicense(request, env, now) {
    const body = await readBody(request);
    requireValue(uuidPattern.test(body.requestId || ''), 400, 'invalid_request_id', '创建请求需要 UUID v4。');
    const id = body.requestId.toLowerCase();
    const order = body.orderRef == null ? null : String(body.orderRef).trim();
    requireValue(order === null || (order.length > 0 && order.length <= 128), 400, 'invalid_order', '购买记录格式无效。');
    const code = await issuedKey(env, id), hash = await keyHash(env, code);
    const existing = await env.DB.prepare('SELECT * FROM licenses WHERE id = ?').bind(id).first();
    requireValue(!existing || (existing.order_ref === order && existing.key_hash === hash), 409, 'request_conflict', '请求编号已用于其他记录或签发密钥已变更。');
    const orderOwner = order && await env.DB.prepare('SELECT id FROM licenses WHERE order_ref = ?').bind(order).first();
    requireValue(!orderOwner || orderOwner.id === id, 409, 'order_conflict', '该购买记录已签发激活码。');
    await env.DB.batch([
        env.DB.prepare('INSERT INTO licenses (id,key_hash,key_hint,created_at,order_ref) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, hash, code.slice(0, 9) + '…', now, order),
        env.DB.prepare("INSERT INTO audit_logs (id,license_id,action,created_at) VALUES (?,?,'create',?) ON CONFLICT(id) DO NOTHING").bind(id, id, now)
    ]);
    const stored = await env.DB.prepare('SELECT * FROM licenses WHERE id = ?').bind(id).first();
    requireValue(stored && stored.order_ref === order && stored.key_hash === hash, 409, 'request_conflict', '请求编号已用于其他记录。');
    return json({ id, licenseKey: code }, existing ? 200 : 201);
}
async function manageLicense(request, env, now, id, action) {
    requireValue(uuidPattern.test(id), 400, 'invalid_id', 'License 编号无效。');
    id = id.toLowerCase();
    const logId = crypto.randomUUID();
    const sql = action === 'disable'
        ? "UPDATE licenses SET status = 'disabled', revision = revision + 1 WHERE id = ?"
        : "UPDATE licenses SET bound_device = NULL, revision = revision + 1 WHERE id = ?";
    const results = await env.DB.batch([
        env.DB.prepare(sql).bind(id),
        env.DB.prepare('INSERT INTO audit_logs (id,license_id,action,created_at) SELECT ?,id,?,? FROM licenses WHERE id = ?').bind(logId, action, now, id)
    ]);
    requireValue(results[0].meta.changes === 1, 404, 'not_found', 'License 不存在。');
    return json({ ok: true, offlineCredentialRevoked: false });
}
export function validateRelease(body, env) {
    requireValue(Number.isSafeInteger(body.versionCode) && body.versionCode > 0 && body.versionCode <= 2147483647 && /^\d+\.\d+\.\d+$/.test(body.versionName || ''), 400, 'invalid_version', '版本号无效。');
    requireValue(Number.isSafeInteger(body.size) && body.size > 0 && body.size <= 2 * 1024 ** 3 && /^[a-f0-9]{64}$/.test(body.sha256 || ''), 400, 'invalid_apk', 'APK 大小或摘要无效。');
    let url; try { url = new URL(body.apkUrl); } catch { throw new HttpError(400, 'invalid_url', '下载地址无效。'); }
    const hosts = String(env.APK_ALLOWED_HOSTS || '').split(',').map(x => x.trim()).filter(Boolean);
    requireValue(url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && !url.hash && hosts.includes(url.hostname) && url.pathname.endsWith('.apk'), 400, 'invalid_url', '下载地址必须是受信任的 HTTPS APK 地址。');
    const changelog = {};
    for (const kind of ['new', 'improved', 'fixed']) {
        const items = body.changelog?.[kind] ?? [];
        requireValue(Array.isArray(items) && items.length <= 30 && items.every(x => typeof x === 'string' && x.trim() && x.length <= 500), 400, 'invalid_changelog', '更新记录无效。');
        changelog[kind] = items;
    }
    const release = { aud: PRODUCT, versionCode: body.versionCode, versionName: body.versionName, apkUrl: url.href, sha256: body.sha256, size: body.size, changelog };
    requireValue(encoder.encode(JSON.stringify(release)).length <= 20000, 400, 'manifest_too_large', '更新清单过大。');
    return release;
}
async function publishRelease(request, env, now) {
    const release = validateRelease(await readBody(request), env);
    const token = await signToken(env, 'BYND-UPDATE', { ...release, iat: now });
    const result = await env.DB.prepare(`INSERT INTO releases (channel,version_code,token,published_at) VALUES ('android-stable',?,?,?)
        ON CONFLICT(channel) DO UPDATE SET version_code = excluded.version_code, token = excluded.token, published_at = excluded.published_at
        WHERE excluded.version_code > releases.version_code`).bind(release.versionCode, token, now).run();
    requireValue(result.meta.changes === 1, 409, 'version_not_newer', '已发布相同或更高版本。');
    return json({ ok: true, versionCode: release.versionCode });
}
export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url), path = url.pathname, now = Math.floor(Date.now() / 1000);
            const admin = path.startsWith('/admin/v1/');
            // Native requests require no CORS. Never allow a random web origin to use the admin API.
            if (admin) await authenticate(request, env);
            if (path === '/license/v1/health' && request.method === 'GET') return json({ ok: true, activationEnabled: env.LICENSE_ACTIVATION_ENABLED === 'true' });
            requireValue(env.DB, 503, 'database_unavailable', '服务尚未配置。');
            if (path === '/updates/v1/android/stable' && request.method === 'GET') {
                const release = await env.DB.prepare("SELECT token FROM releases WHERE channel = 'android-stable'").first();
                return release ? json({ token: release.token }) : json(null, 204);
            }
            const inspect = /^\/admin\/v1\/licenses\/([^/]+)$/.exec(path);
            if (inspect && request.method === 'GET') {
                requireValue(uuidPattern.test(inspect[1]), 400, 'invalid_id', 'License 编号无效。');
                const license = await env.DB.prepare('SELECT id,key_hint,status,created_at,activated_at,bound_device,revision,order_ref FROM licenses WHERE id = ?').bind(inspect[1].toLowerCase()).first();
                requireValue(license, 404, 'not_found', 'License 不存在。');
                return json({ license });
            }
            if (request.method === 'POST') {
                if (path === '/license/v1/challenge') return await challenge(request, env, now);
                if (path === '/license/v1/activate') return await activate(request, env, now);
                if (path === '/admin/v1/licenses') return await createLicense(request, env, now);
                if (path === '/admin/v1/releases/android/stable') return await publishRelease(request, env, now);
                const match = /^\/admin\/v1\/licenses\/([^/]+)\/(disable|unbind)$/.exec(path);
                if (match) return await manageLicense(request, env, now, match[1], match[2]);
            }
            throw new HttpError(404, 'not_found', '接口不存在。');
        } catch (error) {
            if (error instanceof HttpError) return json({ ok: false, code: error.code, message: error.message }, error.status);
            // Database/crypto errors may contain secrets, keys or bound arguments. Do not log them.
            return json({ ok: false, code: 'service_error', message: '服务暂时不可用，请重试。' }, 503);
        }
    }
};
