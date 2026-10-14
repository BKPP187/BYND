const MAX_APK_SIZE = 100000000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = 'id,key_hint,status,created_at,activated_at,bound_device,revision,order_ref,customer_email,last_version_code';
function validateEmail(value, check) {
    if (value === null || value === undefined || value === '') return null;
    check(typeof value === 'string' && value.length <= 254 && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value), 400, 'invalid_email', '邮箱格式无效。');
    return value;
}
function publicOrigin(request, env, check) {
    const origin = new URL(env.PUBLIC_ORIGIN || new URL(request.url).origin);
    check((origin.protocol === 'https:' || (origin.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))) && !origin.username && !origin.password && origin.pathname === '/' && !origin.search && !origin.hash, 503, 'origin_unavailable', '网站来源尚未正确配置。');
    return origin.origin;
}
async function deliveryHandle(env, id, helpers) {
    return helpers.base64url(await helpers.hmac(env.LICENSE_KEY_SECRET, 'delivery:' + id));
}
async function latest(env) {
    const release = await env.DB.prepare("SELECT token FROM releases WHERE channel = 'android-stable'").first();
    if (!release) return null;
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(release.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
    return { token: release.token, claims };
}
async function store(request, env, h) {
    const config = await env.DB.prepare('SELECT price_label,purchase_url FROM storefront WHERE id = 1').first();
    const release = await latest(env);
    let download = null;
    if (release) {
        const artifact = await env.DB.prepare("SELECT filename FROM apk_artifacts WHERE sha256 = ? AND state = 'ready'").bind(release.claims.sha256).first();
        download = { versionName: release.claims.versionName, versionCode: release.claims.versionCode,
            size: release.claims.size, sha256: release.claims.sha256,
            url: artifact ? '/downloads/' + artifact.filename : release.claims.apkUrl };
    }
    const saleOpen = env.SALES_ENABLED === 'true' && !!config?.purchase_url;
    return h.json({ saleOpen, priceLabel: config?.price_label || '待公布', purchaseUrl: saleOpen ? config.purchase_url : '', download });
}
async function createDelivery(request, env, now, licenseId, h) {
    h.requireValue(uuid.test(licenseId), 400, 'invalid_id', 'License 编号无效。');
    licenseId = licenseId.toLowerCase();
    const body = await h.readBody(request);
    h.requireValue(uuid.test(body.requestId || ''), 400, 'invalid_request_id', '领取链接需要 UUID v4 请求编号。');
    const id = body.requestId.toLowerCase(), email = validateEmail(body.email, h.requireValue);
    const origin = publicOrigin(request, env, h.requireValue);
    const license = await env.DB.prepare('SELECT * FROM licenses WHERE id = ?').bind(licenseId).first();
    h.requireValue(license && license.status === 'active', 409, 'license_unavailable', 'License 不存在或已停用。');
    h.requireValue(await h.keyHash(env, await h.issuedKey(env, license.id)) === license.key_hash, 503, 'issuer_mismatch', '签发配置与原授权不一致，不能创建领取链接。');
    const token = await deliveryHandle(env, id, h), tokenHash = await h.digest(new TextEncoder().encode(token));
    const existing = await env.DB.prepare('SELECT * FROM deliveries WHERE id = ?').bind(id).first();
    h.requireValue(!existing || (existing.license_id === licenseId && existing.customer_email === email && existing.token_hash === tokenHash), 409, 'request_conflict', '请求编号已用于另一份领取记录。');
    await env.DB.batch([
        env.DB.prepare('INSERT INTO deliveries (id,license_id,token_hash,customer_email,receipt_origin,created_at,expires_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, licenseId, tokenHash, email, origin, now, now + 30 * 86400),
        env.DB.prepare('UPDATE licenses SET customer_email = COALESCE(?,customer_email) WHERE id = ? AND EXISTS (SELECT 1 FROM deliveries WHERE id = ? AND license_id = ? AND customer_email IS ?)').bind(email, licenseId, id, licenseId, email)
    ]);
    const saved = await env.DB.prepare('SELECT * FROM deliveries WHERE id = ?').bind(id).first();
    h.requireValue(saved && saved.license_id === licenseId && saved.customer_email === email && saved.token_hash === tokenHash, 409, 'request_conflict', '领取记录已变化，请刷新。');
    h.requireValue(saved.expires_at > now, 409, 'delivery_expired', '该领取链接已过期，请使用新请求编号创建。');
    return h.json({ id, receiptUrl: saved.receipt_origin + '/license-receipt.html#' + token,
        expiresAt: saved.expires_at, emailState: saved.email_state });
}
async function receipt(request, env, now, h) {
    h.requireValue(env.RECEIPT_RATE_LIMITER, 503, 'limiter_unavailable', '领取服务尚未配置。');
    const limit = await env.RECEIPT_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' });
    h.requireValue(limit.success, 429, 'rate_limited', '请求过于频繁，请一分钟后重试。');
    const body = await h.readBody(request);
    h.requireValue(typeof body.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(body.token), 403, 'invalid_receipt', '领取链接无效或已过期，请联系支持。');
    const tokenHash = await h.digest(new TextEncoder().encode(body.token));
    const row = await env.DB.prepare(`SELECT d.*,l.status,l.key_hash FROM deliveries d JOIN licenses l ON l.id = d.license_id WHERE d.token_hash = ?`).bind(tokenHash).first();
    h.requireValue(row && row.expires_at > now && row.status === 'active', 403, 'invalid_receipt', '领取链接无效、已过期或激活码已停用，请联系支持。');
    const code = await h.issuedKey(env, row.license_id);
    h.requireValue(await h.keyHash(env, code) === row.key_hash, 503, 'issuer_mismatch', '激活码暂时无法领取，请联系支持。');
    const status = await store(request, env, h); const config = await status.json();
    return h.json({ licenseKey: code, expiresAt: row.expires_at, download: config.download });
}
async function sendEmail(request, env, now, deliveryId, h) {
    h.requireValue(uuid.test(deliveryId), 400, 'invalid_id', '领取记录编号无效。');
    const delivery = await env.DB.prepare('SELECT d.*,l.status,l.key_hash FROM deliveries d JOIN licenses l ON l.id = d.license_id WHERE d.id = ?').bind(deliveryId.toLowerCase()).first();
    h.requireValue(delivery && delivery.status === 'active' && delivery.expires_at > now, 409, 'delivery_unavailable', '领取记录无效、过期或 License 已停用。');
    h.requireValue(delivery.customer_email, 400, 'email_required', '请先为领取记录填写邮箱。');
    if (delivery.email_state === 'accepted') return h.json({ ok: true, emailState: 'accepted', providerId: delivery.email_provider_id });
    const code = await h.issuedKey(env, delivery.license_id);
    h.requireValue(await h.keyHash(env, code) === delivery.key_hash, 503, 'issuer_mismatch', '签发配置与原授权不一致，不能发送激活邮件。');
    h.requireValue(env.EMAIL_ENABLED === 'true' && env.RESEND_API_KEY && typeof env.EMAIL_FROM === 'string' && env.EMAIL_FROM.length <= 254 && !/[\r\n]/.test(env.EMAIL_FROM), 503, 'email_unavailable', '邮件发送尚未配置；你可以复制领取链接交付。');
    // Resend keeps idempotency keys for 24h. Do not silently retry beyond that window.
    h.requireValue(!delivery.email_first_attempt_at || now - delivery.email_first_attempt_at < 23 * 3600, 409, 'email_retry_expired', '邮件结果需要人工核对；重复发送请创建新的领取记录。');
    h.requireValue(delivery.email_state !== 'sending' || now - delivery.email_started_at > 30, 409, 'email_in_progress', '邮件正在发送，请稍后查询状态。');
    const claimed = await env.DB.prepare(`UPDATE deliveries SET email_state = 'sending',email_started_at = ?,email_first_attempt_at = COALESCE(email_first_attempt_at,?),email_from = COALESCE(email_from,?)
        WHERE id = ? AND email_state != 'accepted' AND (email_state != 'sending' OR email_started_at < ?)`).bind(now, now, env.EMAIL_FROM, delivery.id, now - 30).run();
    h.requireValue(claimed.meta.changes === 1, 409, 'email_in_progress', '邮件发送状态已变化，请刷新。');
    const link = delivery.receipt_origin + '/license-receipt.html#' + await deliveryHandle(env, delivery.id, h);
    let response, data;
    try {
        response = await fetch('https://api.resend.com/emails', { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15000), headers: {
            Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': 'bynd-license/' + delivery.id
        }, body: JSON.stringify({ from: delivery.email_from || env.EMAIL_FROM, to: [delivery.customer_email], subject: '欢迎来到 BYND · 你的永久激活码',
            text: '欢迎来到 BYND。\n\n你的永久激活码：\n' + code + '\n\n请保存这封邮件。领取页面（有效期30天）：\n' + link + '\n\n打开领取页面可保存激活码并下载 Android APK。领取链接过期不会使永久激活码失效。\n\nBYND' }) });
        data = await h.readBody(response);
    } catch {
        await env.DB.prepare("UPDATE deliveries SET email_state = 'unknown' WHERE id = ? AND email_state = 'sending'").bind(delivery.id).run();
        h.requireValue(false, 503, 'email_unknown', '邮件发送结果未确认，请稍后用同一记录重试或查询；不要重复创建记录。');
    }
    if (!response.ok || typeof data?.id !== 'string' || !data.id || data.id.length > 128) {
        const uncertain = response.status >= 500 || response.ok;
        await env.DB.prepare('UPDATE deliveries SET email_state = ? WHERE id = ? AND email_state = ?').bind(uncertain ? 'unknown' : 'failed', delivery.id, 'sending').run();
        h.requireValue(false, 503, uncertain ? 'email_unknown' : 'email_failed', uncertain ? '邮件发送结果未确认，请用同一记录重试或查询。' : '邮件服务未接受发送，请检查邮件配置后重试。');
    }
    await env.DB.prepare("UPDATE deliveries SET email_state = 'accepted',email_provider_id = ? WHERE id = ?").bind(data.id, delivery.id).run();
    return h.json({ ok: true, emailState: 'accepted', providerId: data.id });
}
async function uploadArtifact(request, env, now, sha, h) {
    h.requireValue(/^[a-f0-9]{64}$/.test(sha), 400, 'invalid_artifact', '文件摘要格式无效。');
    h.requireValue(env.APK_BUCKET, 503, 'bucket_unavailable', 'APK 存储尚未配置。');
    let metadata; try { metadata = JSON.parse(request.headers.get('x-bynd-artifact') || ''); } catch { metadata = null; }
    h.requireValue(metadata && metadata.sha256 === sha && Number.isSafeInteger(metadata.size) && metadata.size > 0 && metadata.size <= MAX_APK_SIZE
        && Number.isSafeInteger(metadata.versionCode) && metadata.versionCode > 0 && metadata.versionCode <= 2147483647 && /^\d+\.\d+\.\d+$/.test(metadata.versionName || '')
        && metadata.packageName === 'cc.ccwu.bynd' && /^[a-f0-9]{64}$/.test(metadata.signerSha256 || ''), 400, 'invalid_artifact', 'APK 元信息无效，先使用本地发布工具校验安装包。');
    h.requireValue(/^[a-f0-9]{64}$/.test(env.APK_SIGNER_SHA256 || '') && metadata.signerSha256 === env.APK_SIGNER_SHA256, 409, 'signer_mismatch', 'APK 签名与正式证书不一致。');
    h.requireValue(request.body && Number(request.headers.get('content-length')) === metadata.size, 400, 'size_mismatch', '文件大小与元信息不符。');
    const filename = `bynd-${metadata.versionCode}-${sha.slice(0, 16)}.apk`, objectKey = 'android/' + sha + '.apk';
    const existing = await env.DB.prepare('SELECT * FROM apk_artifacts WHERE sha256 = ?').bind(sha).first();
    h.requireValue(!existing || (existing.size === metadata.size && existing.version_code === metadata.versionCode && existing.version_name === metadata.versionName && existing.signer_sha256 === metadata.signerSha256), 409, 'artifact_conflict', '此摘要已登记另一份元信息。');
    const owner = await env.DB.prepare('SELECT sha256 FROM apk_artifacts WHERE version_code = ?').bind(metadata.versionCode).first();
    h.requireValue(!owner || owner.sha256 === sha, 409, 'version_conflict', '这个版本号已登记其他安装包，请递增版本号。');
    if (existing?.state === 'ready') return h.json({ ok: true, artifact: existing });
    await env.DB.prepare(`INSERT INTO apk_artifacts (sha256,object_key,filename,version_code,version_name,size,signer_sha256,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(sha256) DO NOTHING`).bind(sha, objectKey, filename, metadata.versionCode, metadata.versionName, metadata.size, metadata.signerSha256, now).run();
    // R2 validates the actual stream checksum. Metadata alone never marks a file ready.
    const object = await env.APK_BUCKET.put(objectKey, request.body, { sha256: sha,
        httpMetadata: { contentType: 'application/vnd.android.package-archive' }, customMetadata: { sha256: sha } });
    h.requireValue(object && object.size === metadata.size, 409, 'size_mismatch', '已上传文件大小不符，未开放下载。');
    await env.DB.prepare("UPDATE apk_artifacts SET state = 'ready' WHERE sha256 = ?").bind(sha).run();
    return h.json({ ok: true, artifact: await env.DB.prepare('SELECT * FROM apk_artifacts WHERE sha256 = ?').bind(sha).first() });
}
async function download(request, env, filename, h) {
    h.requireValue(/^bynd-\d+-[a-f0-9]{16}\.apk$/.test(filename), 404, 'not_found', '下载不存在。');
    h.requireValue(env.APK_BUCKET, 503, 'bucket_unavailable', '下载服务尚未配置。');
    const artifact = await env.DB.prepare("SELECT * FROM apk_artifacts WHERE filename = ? AND state = 'ready'").bind(filename).first();
    h.requireValue(artifact, 404, 'not_found', '安装包尚未开放下载。');
    let range = null;
    const rangeHeader = request.headers.get('range'), tag = '"' + artifact.sha256 + '"', unchanged = request.headers.get('if-none-match') === tag;
    if (rangeHeader && !unchanged && request.method !== 'HEAD' && (!request.headers.has('if-range') || request.headers.get('if-range') === tag)) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
        if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + artifact.size } });
        const start = match[1] ? Number(match[1]) : Math.max(0, artifact.size - Number(match[2]));
        const end = match[1] && match[2] ? Math.min(artifact.size - 1, Number(match[2])) : artifact.size - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= artifact.size || end < start || (!match[1] && Number(match[2]) === 0)) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + artifact.size } });
        range = { offset: start, length: end - start + 1 };
    }
    const object = request.method === 'HEAD' || unchanged ? await env.APK_BUCKET.head(artifact.object_key) : await env.APK_BUCKET.get(artifact.object_key, range ? { range } : undefined);
    h.requireValue(object && object.size === artifact.size && object.customMetadata?.sha256 === artifact.sha256, 503, 'artifact_unavailable', '安装包存储校验失败，请稍后重试。');
    const headers = new Headers({ 'Content-Type': 'application/vnd.android.package-archive', 'Content-Disposition': `attachment; filename="BYND-v${artifact.version_name}.apk"`,
        'Cache-Control': 'public,max-age=31536000,immutable,no-transform', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', ETag: '"' + artifact.sha256 + '"' });
    if (request.headers.get('if-none-match') === headers.get('etag')) return new Response(null, { status: 304, headers });
    if (range) {
        const start = range.offset, length = range.length;
        headers.set('Content-Range', `bytes ${start}-${start + length - 1}/${artifact.size}`); headers.set('Content-Length', String(length));
        return new Response(object.body, { status: 206, headers });
    }
    headers.set('Content-Length', String(artifact.size));
    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
}
export async function handleDistribution(request, env, now, h) {
    const url = new URL(request.url), route = url.pathname, method = request.method;
    if (route === '/distribution/v1/store' && method === 'GET') return store(request, env, h);
    if (route === '/license/v1/receipt' && method === 'POST') return receipt(request, env, now, h);
    const delivery = /^\/admin\/v1\/licenses\/([^/]+)\/delivery$/.exec(route);
    if (delivery && method === 'POST') return createDelivery(request, env, now, delivery[1], h);
    const recover = /^\/admin\/v1\/licenses\/([^/]+)\/recover$/.exec(route);
    if (recover && method === 'POST') {
        h.requireValue(uuid.test(recover[1]), 400, 'invalid_id', 'License 编号无效。');
        const license = await env.DB.prepare('SELECT id,status,key_hash FROM licenses WHERE id = ?').bind(recover[1].toLowerCase()).first();
        h.requireValue(license && license.status === 'active', 409, 'license_unavailable', 'License 不存在或已停用。');
        const code = await h.issuedKey(env, license.id);
        h.requireValue(await h.keyHash(env, code) === license.key_hash, 503, 'issuer_mismatch', '签发配置与原授权不一致，无法恢复激活码。');
        return h.json({ licenseKey: code });
    }
    const email = /^\/admin\/v1\/deliveries\/([^/]+)\/email$/.exec(route);
    if (email && method === 'POST') return sendEmail(request, env, now, email[1], h);
    const deliveryList = /^\/admin\/v1\/licenses\/([^/]+)\/deliveries$/.exec(route);
    if (deliveryList && method === 'GET') {
        const rows = await env.DB.prepare('SELECT id,customer_email,created_at,expires_at,email_state,email_provider_id FROM deliveries WHERE license_id = ? ORDER BY created_at DESC,id DESC LIMIT 20').bind(deliveryList[1]).all();
        return h.json({ deliveries: rows.results });
    }
    if (route === '/admin/v1/licenses' && method === 'GET') {
        const search = (url.searchParams.get('q') || '').trim();
        h.requireValue(search.length <= 128, 400, 'invalid_search', '搜索内容过长。');
        const limit = 30, cursor = url.searchParams.get('cursor') || '';
        h.requireValue(!cursor || uuid.test(cursor), 400, 'invalid_cursor', '翻页编号无效。');
        const rows = await env.DB.prepare(`SELECT ${fields} FROM licenses WHERE (? = '' OR id > ?) AND (? = '' OR instr(COALESCE(order_ref,''),?) > 0 OR instr(key_hint,?) > 0 OR instr(COALESCE(customer_email,''),?) > 0 OR id = ?) ORDER BY id LIMIT ?`).bind(cursor, cursor, search, search, search, search, search, limit + 1).all();
        return h.json({ licenses: rows.results.slice(0, limit), nextCursor: rows.results.length > limit ? rows.results[limit - 1].id : null });
    }
    if (route === '/admin/v1/config' && method === 'GET') {
        const status = await store(request, env, h);
        const configured = await env.DB.prepare('SELECT purchase_url FROM storefront WHERE id = 1').first();
        return h.json({ ...(await status.json()), activationEnabled: env.LICENSE_ACTIVATION_ENABLED === 'true', emailEnabled: env.EMAIL_ENABLED === 'true' && !!env.RESEND_API_KEY && !!env.EMAIL_FROM,
            configuredPurchaseUrl: configured?.purchase_url || '',
            uploadsEnabled: !!env.APK_BUCKET && /^[a-f0-9]{64}$/.test(env.APK_SIGNER_SHA256 || '') });
    }
    if (route === '/admin/v1/store' && method === 'POST') {
        const body = await h.readBody(request), price = String(body.priceLabel || '').trim(), link = String(body.purchaseUrl || '').trim();
        h.requireValue(price.length > 0 && price.length <= 40, 400, 'invalid_price', '价格文案需要1至40个字符。');
        if (link) { let address; try { address = new URL(link); } catch { /* rejected below */ }
            h.requireValue(address && address.protocol === 'https:' && !address.username && !address.password && !/[\r\n]/.test(link) && link.length <= 2048, 400, 'invalid_purchase_url', '购买或人工联系地址需要有效的 HTTPS 链接。'); }
        await env.DB.prepare('UPDATE storefront SET price_label = ?,purchase_url = ? WHERE id = 1').bind(price, link).run();
        return store(request, env, h);
    }
    const upload = /^\/admin\/v1\/artifacts\/([a-f0-9]+)$/.exec(route);
    if (upload && method === 'POST') return uploadArtifact(request, env, now, upload[1], h);
    if (route === '/admin/v1/artifacts' && method === 'GET') return h.json({ artifacts: (await env.DB.prepare("SELECT * FROM apk_artifacts WHERE state = 'ready' ORDER BY version_code DESC LIMIT 20").all()).results });
    if (route.startsWith('/downloads/') && ['GET', 'HEAD'].includes(method)) return download(request, env, route.slice('/downloads/'.length), h);
    return null;
}
