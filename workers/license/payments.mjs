import { requireAccount } from './accounts.mjs';
import { sandboxAlipay } from './alipay-sandbox.mjs';

const priceFen = 1388, uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const paid = new Set(['TRADE_SUCCESS', 'TRADE_FINISHED']);
function localSandbox(request, env) {
    const url = new URL(request.url);
    return env.PAYMENT_SANDBOX_ENABLED === 'true' && env.PAYMENT_ISOLATION === 'sandbox-v1' && url.origin === env.PUBLIC_ORIGIN
        && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}
function money(value) {
    const text = String(value ?? ''); if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(text)) return -1;
    const [whole, fraction = ''] = text.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
function view(row) {
    return { id: row.id, orderNo: row.order_no, amountFen: row.amount_fen, state: row.state, mode: 'sandbox',
        createdAt: row.created_at, expiresAt: row.expires_at, licenseId: row.license_id, paidAt: row.paid_at };
}
function sameConfiguration(order, env, h) {
    h.requireValue(order.app_id === env.ALIPAY_SANDBOX_APP_ID && order.seller_id === env.ALIPAY_SANDBOX_SELLER_ID && [1280, 1288, priceFen].includes(order.amount_fen),
        409, 'payment_config_changed', '此订单的测试商户配置已变化，请联系支持。');
}
async function limited(request, env, h) {
    h.requireValue(env.PAYMENT_RATE_LIMITER, 503, 'payment_unavailable', '测试支付尚未配置。');
    h.requireValue((await env.PAYMENT_RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'local' })).success, 429, 'payment_rate_limit', '查询太频繁，请稍后重试。');
}
async function issued(env, order, now, transaction, h) {
    const code = await h.issuedKey(env, order.id), hash = await h.keyHash(env, code), ref = 'alipay-sandbox:' + order.order_no;
    // Every statement is part of one D1 transaction. Retries/concurrent checks select
    // the same license; a failed ownership/audit write rolls the entire issuance back.
    await env.DB.batch([
        env.DB.prepare("UPDATE sandbox_payment_orders SET trade_no=? WHERE id=? AND state='pending' AND (trade_no IS NULL OR trade_no=?)").bind(transaction, order.id, transaction),
        env.DB.prepare(`INSERT INTO licenses (id,key_hash,key_hint,created_at,order_ref,customer_email,issuance_email)
            SELECT p.id,?,?,?, ?,a.email,a.email FROM sandbox_payment_orders p JOIN accounts a ON a.id=p.user_id
            WHERE p.id=? AND p.state='pending' AND p.trade_no=?`).bind(hash, code.slice(0, 9) + '…', now, ref, order.id, transaction),
        env.DB.prepare(`INSERT INTO account_licenses (license_id,user_id,claimed_at)
            SELECT id,user_id,? FROM sandbox_payment_orders WHERE id=? AND state='pending' AND trade_no=?`).bind(now, order.id, transaction),
        env.DB.prepare(`INSERT INTO audit_logs (id,license_id,action,created_at)
            SELECT id,id,'sandbox-payment',? FROM sandbox_payment_orders WHERE id=? AND state='pending' AND trade_no=?`).bind(now, order.id, transaction),
        env.DB.prepare(`UPDATE sandbox_payment_orders SET state='issued',license_id=id,paid_at=?,checked_at=?
            WHERE id=? AND state='pending' AND trade_no=?`).bind(now, now, order.id, transaction)
    ]);
    const saved = await env.DB.prepare('SELECT * FROM sandbox_payment_orders WHERE id=?').bind(order.id).first();
    const license = await env.DB.prepare('SELECT l.key_hash,l.order_ref,a.user_id FROM licenses l JOIN account_licenses a ON a.license_id=l.id WHERE l.id=?').bind(order.id).first();
    h.requireValue(saved.state === 'issued' && saved.trade_no === transaction && license?.key_hash === hash && license.order_ref === ref && license.user_id === saved.user_id,
        409, 'payment_conflict', '订单状态发生变化，请重新查询。');
    return saved;
}
async function reconcile(env, order, now, client, h, notificationTrade = null) {
    sameConfiguration(order, env, h);
    let result; try { result = await client.query(order.order_no, now); } catch { h.requireValue(false, 503, 'payment_query_failed', '未能确认支付宝测试交易，请稍后查询，不要重复付款。'); }
    if (result.code === '40004' && result.sub_code === 'ACQ.TRADE_NOT_EXIST') return { order, providerState: 'NOT_CREATED' };
    h.requireValue(result.code === '10000', 503, 'payment_query_failed', '支付宝暂未确认测试交易，请稍后查询。');
    h.requireValue(result.out_trade_no === order.order_no && money(result.total_amount) === order.amount_fen
        && (result.app_id === undefined || result.app_id === order.app_id) && (result.seller_id === undefined || result.seller_id === order.seller_id),
    409, 'payment_mismatch', '交易信息与订单不符，不能发放激活码。');
    h.requireValue(typeof result.trade_no === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(result.trade_no)
        && (!order.trade_no || order.trade_no === result.trade_no) && (notificationTrade === null || notificationTrade === result.trade_no),
    409, 'payment_mismatch', '交易编号与订单不符。');
    const status = result.trade_status;
    h.requireValue(['WAIT_BUYER_PAY', 'TRADE_CLOSED', ...paid].includes(status), 503, 'payment_unknown_state', '交易状态尚无法确认，请稍后查询。');
    if (paid.has(status)) {
        h.requireValue(order.state !== 'closed' && order.state !== 'refunded', 409, 'payment_closed', '此测试订单已经关闭。');
        order = await issued(env, order, now, result.trade_no, h);
    } else if (status === 'TRADE_CLOSED') {
        await env.DB.batch([
            env.DB.prepare(`UPDATE licenses SET status='disabled',revision=revision+1 WHERE id=? AND EXISTS
                (SELECT 1 FROM sandbox_payment_orders WHERE id=? AND state='issued')`).bind(order.license_id, order.id),
            env.DB.prepare(`UPDATE sandbox_payment_orders SET state=CASE WHEN state='issued' THEN 'refunded' ELSE 'closed' END,checked_at=?
                WHERE id=? AND state IN ('pending','issued')`).bind(now, order.id)
        ]);
        order = await env.DB.prepare('SELECT * FROM sandbox_payment_orders WHERE id=?').bind(order.id).first();
    }
    return { order, providerState: status };
}
async function notificationBody(request, h) {
    h.requireValue((request.headers.get('content-type') || '').split(';')[0].trim() === 'application/x-www-form-urlencoded', 415, 'form_required', '通知格式无效。');
    const reader = request.body?.getReader(); h.requireValue(reader, 400, 'invalid_notification', '通知为空。');
    let size = 0; const parts = [];
    while (true) {
        const { value, done } = await reader.read(); if (done) break; size += value.length;
        if (size > 32768) { await reader.cancel(); h.requireValue(false, 413, 'body_too_large', '通知过大。'); } parts.push(value);
    }
    const body = new Uint8Array(size); let offset = 0; for (const part of parts) { body.set(part, offset); offset += part.length; }
    let text; try { text = new TextDecoder('utf-8', { fatal: true }).decode(body); } catch { h.requireValue(false, 400, 'invalid_notification', '通知编码无效。'); }
    const parameters = Object.create(null);
    for (const [name, value] of new URLSearchParams(text)) { h.requireValue(!Object.hasOwn(parameters, name), 400, 'duplicate_field', '通知字段重复。'); parameters[name] = value; }
    return parameters;
}
export async function handlePayments(request, env, now, h) {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/payment/v1/')) return null;
    const enabled = localSandbox(request, env);
    if (path === '/payment/v1/config' && request.method === 'GET') return h.json({ mode: enabled ? 'sandbox' : 'disabled', amountFen: priceFen, saleOpen: false });
    h.requireValue(enabled, 503, 'payment_not_open', '尚未开售，支付入口未开放。');
    let client; try { client = sandboxAlipay(env); } catch { h.requireValue(false, 503, 'payment_unavailable', '支付宝测试配置不完整。'); }
    if (path === '/payment/v1/alipay/notify' && request.method === 'POST') {
        const parameters = await notificationBody(request, h);
        h.requireValue(client.verifyNotification(parameters), 403, 'invalid_payment_signature', '通知签名无效。');
        h.requireValue(parameters.app_id === env.ALIPAY_SANDBOX_APP_ID && parameters.seller_id === env.ALIPAY_SANDBOX_SELLER_ID,
            409, 'payment_mismatch', '通知与测试商户不符。');
        const order = await env.DB.prepare('SELECT * FROM sandbox_payment_orders WHERE order_no=?').bind(parameters.out_trade_no || '').first();
        h.requireValue(order, 404, 'order_not_found', '订单不存在。');
        h.requireValue(money(parameters.total_amount) === order.amount_fen, 409, 'payment_mismatch', '通知金额与订单不符。');
        const checked = await reconcile(env, order, now, client, h, parameters.trade_no || '');
        h.requireValue(!paid.has(parameters.trade_status) || ['issued','closed','refunded'].includes(checked.order.state), 503, 'payment_pending', '尚未确认到账，请重试。');
        h.requireValue(!checked.order.trade_no || checked.order.trade_no === parameters.trade_no, 409, 'payment_mismatch', '通知交易编号不符。');
        return new Response('success', { headers: { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    const user = await requireAccount(request, env, now, h);
    if (request.method === 'POST') {
        h.requireValue(request.headers.get('origin') === url.origin && request.headers.get('X-BYND-Payment') === '1', 403, 'payment_origin_rejected', '请从 BYND 测试页面操作。');
        await limited(request, env, h);
    }
    if (path === '/payment/v1/orders' && request.method === 'GET') {
        const rows = (await env.DB.prepare('SELECT * FROM sandbox_payment_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 10').bind(user.id).all()).results;
        return h.json({ orders: rows.map(view) });
    }
    if (path === '/payment/v1/orders' && request.method === 'POST') {
        const body = await h.readBody(request);
        h.requireValue(uuid.test(body.requestId || '') && Object.keys(body).every(key => key === 'requestId'), 400, 'invalid_payment_request', '订单请求无效，请勿传入金额或付款状态。');
        const requestId = body.requestId.toLowerCase(), id = crypto.randomUUID(), orderNo = 'BYNDS' + id.replace(/-/g, '');
        const count = await env.DB.prepare("SELECT count(*) AS n FROM sandbox_payment_orders WHERE user_id=? AND state='pending' AND expires_at>?").bind(user.id, now).first();
        let order = await env.DB.prepare('SELECT * FROM sandbox_payment_orders WHERE user_id=? AND request_id=?').bind(user.id, requestId).first();
        h.requireValue(order || count.n < 5, 429, 'too_many_orders', '请先查询已有测试订单，不要重复下单。');
        if (!order) {
            await env.DB.prepare(`INSERT INTO sandbox_payment_orders (id,user_id,request_id,order_no,app_id,seller_id,amount_fen,created_at,expires_at)
                VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,request_id) DO NOTHING`).bind(id, user.id, requestId, orderNo, env.ALIPAY_SANDBOX_APP_ID, env.ALIPAY_SANDBOX_SELLER_ID, priceFen, now, now + 1800).run();
            order = await env.DB.prepare('SELECT * FROM sandbox_payment_orders WHERE user_id=? AND request_id=?').bind(user.id, requestId).first();
        }
        sameConfiguration(order, env, h);
        return h.json({ order: view(order), paymentUrl: order.state === 'pending' && order.expires_at > now ? client.pageUrl(order, url.origin, now) : null });
    }
    const match = /^\/payment\/v1\/orders\/([a-f0-9-]{36})(\/check)?$/.exec(path);
    if (match && ((request.method === 'GET' && !match[2]) || (request.method === 'POST' && match[2]))) {
        let order = await env.DB.prepare('SELECT * FROM sandbox_payment_orders WHERE id=? AND user_id=?').bind(match[1], user.id).first();
        h.requireValue(order, 404, 'order_not_found', '订单不存在或不属于当前账号。');
        if (!match[2]) {
            sameConfiguration(order, env, h);
            return h.json({ order: view(order), paymentUrl: order.state === 'pending' && order.expires_at > now ? client.pageUrl(order, url.origin, now) : null });
        }
        const body = await h.readBody(request); h.requireValue(Object.keys(body).length === 0, 400, 'invalid_payment_request', '付款结果只能由服务端核验。');
        const checked = await reconcile(env, order, now, client, h); return h.json({ order: view(checked.order), providerState: checked.providerState });
    }
    h.requireValue(false, 404, 'not_found', '接口不存在。');
}
