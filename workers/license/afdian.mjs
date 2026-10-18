import { requireAccount } from './accounts.mjs';
import { queryAfdian, exchangeAfdian } from './afdian-client.mjs';

const root = '/license/v1/pay/afdian', orderPattern = /^[0-9]{10,64}$/, encoder = new TextEncoder();
function configured(env) {
    let url, origin; try { url = new URL(env.AFDIAN_PURCHASE_URL); origin = new URL(env.PUBLIC_ORIGIN); } catch { return false; }
    return env.AFDIAN_ENABLED === 'true' && !!env.AFDIAN_API_TOKEN && !!env.AFDIAN_USER_ID && !!env.AFDIAN_PLAN_ID
        && !!env.AFDIAN_CLIENT_ID && !!env.AFDIAN_CLIENT_SECRET && !!env.PAYMENT_RATE_LIMITER
        && typeof env.AFDIAN_WEBHOOK_SECRET === 'string' && env.AFDIAN_WEBHOOK_SECRET.length >= 32
        && origin.origin === env.PUBLIC_ORIGIN && !origin.username && !origin.password
        && (origin.protocol === 'https:' || (origin.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(origin.hostname)))
        && url.origin === 'https://afdian.com' && !url.username && !url.password && !url.hash
        && ['0','1'].includes(env.AFDIAN_PRODUCT_TYPE) && (env.AFDIAN_PRODUCT_TYPE !== '1' || !!env.AFDIAN_SKU_ID);
}
function open(env) { return env.SALES_ENABLED === 'true' && configured(env); }
export const afdianSaleOpen = open;
function fields(body, allowed, h) {
    h.requireValue(Object.keys(body).every(key => allowed.includes(key)), 400, 'invalid_fields', '请求包含不支持的字段。');
}
function validOrder(value, h) { h.requireValue(typeof value === 'string' && orderPattern.test(value), 400, 'invalid_order', '请填写爱发电订单号。'); }
async function enqueue(env, orderNo, now) {
    await env.DB.prepare(`INSERT INTO afdian_jobs(out_trade_no,next_at) VALUES (?,?)
        ON CONFLICT(out_trade_no) DO UPDATE SET state='pending',next_at=excluded.next_at
        WHERE afdian_jobs.state='rejected'`).bind(orderNo, now).run();
}
function matchesProduct(order, env) {
    // Compare gross actual payment, never display price or the creator's net proceeds.
    return order.status === 2 && order.total_amount === '13.88' && order.plan_id === env.AFDIAN_PLAN_ID
        && order.month === 1 && !order.redeem_id && order.product_type === Number(env.AFDIAN_PRODUCT_TYPE)
        && (order.product_type === 0 || (Array.isArray(order.sku_detail) && order.sku_detail.length === 1
            && order.sku_detail[0].sku_id === env.AFDIAN_SKU_ID && order.sku_detail[0].count === 1));
}
async function fulfill(env, remote, account, now, h) {
    await env.DB.prepare(`INSERT INTO afdian_orders(id,out_trade_no,user_id,provider_user_id,creator_id,plan_id,amount_fen,created_at)
        VALUES (?,?,?,?,?,?,1388,?) ON CONFLICT(out_trade_no) DO NOTHING`)
        .bind(crypto.randomUUID(), remote.out_trade_no, account.user_id, remote.user_id, env.AFDIAN_USER_ID, remote.plan_id, now).run();
    const order = await env.DB.prepare('SELECT * FROM afdian_orders WHERE out_trade_no=?').bind(remote.out_trade_no).first();
    h.requireValue(order.user_id === account.user_id && order.provider_user_id === remote.user_id && order.creator_id === env.AFDIAN_USER_ID
        && order.plan_id === remote.plan_id, 409, 'afdian_conflict', '订单归属发生变化，未发放授权。');
    const code = await h.issuedKey(env, order.id), hash = await h.keyHash(env, code);
    const token = h.base64url(await h.hmac(env.LICENSE_KEY_SECRET, 'delivery:' + order.id));
    const tokenHash = await h.digest(encoder.encode(token));
    // D1 batch is atomic. All inserts are conditional on the same verified row.
    await env.DB.batch([
        env.DB.prepare(`INSERT INTO licenses(id,key_hash,key_hint,created_at,order_ref,customer_email,issuance_email)
            SELECT p.id,?,?,?,'afdian:'||p.out_trade_no,a.email,a.email FROM afdian_orders p JOIN accounts a ON a.id=p.user_id
            WHERE p.id=? AND p.state='verified'`).bind(hash, code.slice(0,9)+'…', now, order.id),
        env.DB.prepare(`INSERT INTO account_licenses(license_id,user_id,claimed_at)
            SELECT id,user_id,? FROM afdian_orders WHERE id=? AND state='verified'`).bind(now, order.id),
        env.DB.prepare(`INSERT INTO deliveries(id,license_id,token_hash,customer_email,receipt_origin,created_at,expires_at)
            SELECT p.id,p.id,?,a.email,?,?,? FROM afdian_orders p JOIN accounts a ON a.id=p.user_id
            WHERE p.id=? AND p.state='verified'`).bind(tokenHash, env.PUBLIC_ORIGIN, now, now+30*86400, order.id),
        env.DB.prepare(`INSERT INTO audit_logs(id,license_id,action,created_at)
            SELECT id,id,'afdian-payment',? FROM afdian_orders WHERE id=? AND state='verified'`).bind(now, order.id),
        env.DB.prepare("UPDATE afdian_orders SET state='issued',license_id=id WHERE id=? AND state='verified'").bind(order.id)
    ]);
    return order.id;
}
async function reconcile(env, orderNo, now, h, expectedUser = null) {
    let remote;
    try { remote = await queryAfdian(env, orderNo, now); }
    catch { return { state: 'retry', message: '爱发电暂时无法核验，请稍后重试，不要重复付款。' }; }
    if (!matchesProduct(remote, env)) return { state: 'rejected', message: '付款状态、金额或方案不匹配，未发放激活码。' };
    const account = await env.DB.prepare('SELECT * FROM afdian_accounts WHERE provider_user_id=?').bind(remote.user_id || '').first();
    if (!account) return { state: 'retry', message: '付款人尚未关联 BYND 账号；关联后可重新核对。' };
    if (expectedUser && account.user_id !== expectedUser) return { state: 'rejected', message: '无法在当前账号领取这笔订单。' };
    const id = await fulfill(env, remote, account, now, h);
    return { state: 'issued', licenseId: id, message: '已核验到账，激活码已保存到付款人的 BYND 账号。' };
}
export async function drainAfdian(env, now, h, onlyOrder = null) {
    if (!open(env)) return;
    const rows = (await env.DB.prepare(`SELECT out_trade_no FROM afdian_jobs WHERE state IN ('pending','processing') AND next_at<=?
        AND (? IS NULL OR out_trade_no=?) ORDER BY next_at LIMIT 10`).bind(now, onlyOrder, onlyOrder).all()).results;
    for (const row of rows) {
        const lease = crypto.randomUUID();
        const claimed = await env.DB.prepare(`UPDATE afdian_jobs SET state='processing',lease=?,attempts=attempts+1,next_at=?
            WHERE out_trade_no=? AND state IN ('pending','processing') AND next_at<=?`).bind(lease, now+120, row.out_trade_no, now).run();
        if (claimed.meta.changes !== 1) continue;
        let result; try { result = await reconcile(env, row.out_trade_no, now, h); } catch { result = { state: 'retry' }; }
        await env.DB.prepare(`UPDATE afdian_jobs SET state=?,next_at=?,last_result=?,lease=NULL WHERE out_trade_no=? AND lease=?`)
            .bind(result.state === 'issued' ? 'done' : result.state === 'rejected' ? 'rejected' : 'pending', now+300, result.state, row.out_trade_no, lease).run();
    }
}
export async function handleAfdian(request, env, now, h, ctx) {
    const path = new URL(request.url).pathname, admin = path === '/admin/v1/pay/afdian/recheck';
    if (!path.startsWith(root + '/') && !admin) return null;
    if (path === root + '/config' && request.method === 'GET') return h.json({ saleOpen: open(env), amountFen: 1388 });
    h.requireValue(open(env), 503, 'not_on_sale', '尚未开售，爱发电付款尚未开放。');
    h.requireValue((await env.PAYMENT_RATE_LIMITER.limit({ key: 'afdian:' + (request.headers.get('CF-Connecting-IP') || 'local') })).success,
        429, 'rate_limited', '操作太频繁，请稍后重试。');
    if (path === root + '/webhook' && request.method === 'POST') {
        const supplied = new URL(request.url).searchParams.get('key') || '';
        const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(supplied)));
        const expected = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(env.AFDIAN_WEBHOOK_SECRET)));
        let mismatch = 0; for (let i=0; i<actual.length; i++) mismatch |= actual[i] ^ expected[i];
        h.requireValue(mismatch === 0, 403, 'invalid_notification', '通知入口验证失败。');
        const body = await h.readBody(request), orderNo = body.data?.order?.out_trade_no;
        h.requireValue(body.data?.type === 'order', 400, 'invalid_notification', '通知类型无效。'); validOrder(orderNo, h);
        const existing = await env.DB.prepare('SELECT out_trade_no FROM afdian_jobs WHERE out_trade_no=?').bind(orderNo).first();
        const count = await env.DB.prepare("SELECT count(*) AS n FROM afdian_jobs WHERE state IN ('pending','processing')").first();
        h.requireValue(existing || count.n < 1000, 503, 'queue_full', '核验队列繁忙，请重试。');
        await enqueue(env, orderNo, now);
        // No account/price/status fields from the notification are trusted.
        const work = drainAfdian(env, now, h, orderNo).catch(() => {});
        if (ctx?.waitUntil) ctx.waitUntil(work); else await work;
        return h.json({ ec: 200, em: '' });
    }
    if (admin) {
        h.requireValue(request.method === 'POST', 405, 'method_not_allowed', '请使用 POST。');
        // Worker authenticates all /admin/v1 requests before routing here.
        const body = await h.readBody(request); fields(body, ['orderNo'], h); validOrder(body.orderNo, h);
        await enqueue(env, body.orderNo, now);
        const result = await reconcile(env, body.orderNo, now, h);
        return h.json(result, result.state === 'retry' ? 503 : result.state === 'rejected' ? 409 : 200);
    }
    const user = await requireAccount(request, env, now, h);
    if (request.method === 'POST') h.requireValue(request.headers.get('Origin') === env.PUBLIC_ORIGIN && request.headers.get('X-BYND-Payment') === '1',
        403, 'invalid_origin', '请从 BYND 页面操作。');
    if (path === root + '/status' && request.method === 'GET') {
        const binding = await env.DB.prepare('SELECT user_id FROM afdian_accounts WHERE user_id=?').bind(user.id).first();
        const orders = (await env.DB.prepare(`SELECT p.out_trade_no,p.license_id,d.id AS delivery_id,d.expires_at,l.status FROM afdian_orders p
            JOIN licenses l ON l.id=p.license_id JOIN deliveries d ON d.id=p.id WHERE p.user_id=? AND p.state='issued' ORDER BY p.created_at DESC LIMIT 20`).bind(user.id).all()).results;
        const output = [];
        for (const row of orders) output.push({ orderNo: row.out_trade_no, licenseId: row.license_id,
            receiptUrl: row.status === 'active' && row.expires_at > now ? env.PUBLIC_ORIGIN + '/license-receipt.html#'
                + h.base64url(await h.hmac(env.LICENSE_KEY_SECRET, 'delivery:' + row.delivery_id)) : null });
        return h.json({ linked: !!binding, purchaseUrl: binding ? env.AFDIAN_PURCHASE_URL : null, orders: output });
    }
    if (path === root + '/link' && request.method === 'POST') {
        const body = await h.readBody(request); fields(body, [], h);
        const state = h.base64url(crypto.getRandomValues(new Uint8Array(32))), stateHash = await h.digest(encoder.encode(state));
        await env.DB.prepare('DELETE FROM afdian_oauth_states WHERE user_id=? OR expires_at<=?').bind(user.id, now).run();
        await env.DB.prepare('INSERT INTO afdian_oauth_states(state_hash,user_id,session_hash,expires_at) VALUES (?,?,?,?)')
            .bind(stateHash, user.id, user.token_hash, now+600).run();
        const url = new URL('https://afdian.com/oauth2/authorize');
        url.search = new URLSearchParams({ response_type: 'code', scope: 'basic', client_id: env.AFDIAN_CLIENT_ID,
            redirect_uri: env.PUBLIC_ORIGIN + '/checkout.html', state }).toString();
        return h.json({ url: url.href });
    }
    if (path === root + '/callback' && request.method === 'POST') {
        const body = await h.readBody(request); fields(body, ['code','state'], h);
        h.requireValue(typeof body.state === 'string' && /^[A-Za-z0-9_-]{43}$/.test(body.state) && typeof body.code === 'string'
            && body.code.length > 0 && body.code.length <= 1024, 400, 'invalid_oauth', '关联参数无效。');
        const hash = await h.digest(encoder.encode(body.state));
        const used = await env.DB.prepare(`UPDATE afdian_oauth_states SET used_at=? WHERE state_hash=? AND user_id=? AND session_hash=? AND used_at IS NULL AND expires_at>?`)
            .bind(now, hash, user.id, user.token_hash, now).run();
        h.requireValue(used.meta.changes === 1, 403, 'invalid_oauth', '关联已过期或登录身份变化，请重新关联。');
        let providerId; try { providerId = await exchangeAfdian(env, body.code); }
        catch { h.requireValue(false, 503, 'oauth_failed', '爱发电授权暂未完成，请重新关联。'); }
        await env.DB.prepare('INSERT INTO afdian_accounts(user_id,provider_user_id,created_at) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(user.id, providerId, now).run();
        const linked = await env.DB.prepare('SELECT provider_user_id FROM afdian_accounts WHERE user_id=?').bind(user.id).first();
        h.requireValue(linked?.provider_user_id === providerId, 409, 'binding_conflict', '该账号已有不同关联，请联系支持。');
        return h.json({ linked: true });
    }
    if (path === root + '/check' && request.method === 'POST') {
        const body = await h.readBody(request); fields(body, ['orderNo'], h); validOrder(body.orderNo, h);
        const result = await reconcile(env, body.orderNo, now, h, user.id);
        return h.json(result, result.state === 'retry' ? 503 : result.state === 'rejected' ? 409 : 200);
    }
    h.requireValue(false, 404, 'not_found', '接口不存在。');
}
