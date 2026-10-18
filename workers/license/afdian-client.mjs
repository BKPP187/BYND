import { createHash } from 'node:crypto';

// Fixed official HTTPS endpoints; neither webhook nor client controls the host.
export const AFDIAN_QUERY = 'https://afdian.com/api/open/query-order';
export const AFDIAN_OAUTH = 'https://afdian.com/api/oauth2/access_token';
export function afdianSignature(token, params, ts, userId) {
    return createHash('md5').update(token + 'params' + params + 'ts' + ts + 'user_id' + userId).digest('hex');
}
async function post(url, body, contentType) {
    const response = await fetch(url, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': contentType }, body });
    if (!response.ok || !response.body) throw Error('afdian_unavailable');
    const reader = response.body.getReader(), chunks = []; let size = 0;
    while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 65536) { await reader.cancel(); throw Error('afdian_unavailable'); }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    // Never return provider debug/error bodies (they may contain signing input).
    if (data?.ec !== 200) throw Error('afdian_unavailable');
    return data.data;
}
export async function queryAfdian(env, orderNo, now) {
    const params = JSON.stringify({ out_trade_no: orderNo }), ts = now;
    const data = await post(AFDIAN_QUERY, JSON.stringify({ user_id: env.AFDIAN_USER_ID, params, ts,
        sign: afdianSignature(env.AFDIAN_API_TOKEN, params, ts, env.AFDIAN_USER_ID) }), 'application/json');
    if (!Array.isArray(data?.list)) throw Error('afdian_unavailable');
    const matches = data.list.filter(order => order?.out_trade_no === orderNo);
    if (matches.length !== 1) throw Error('afdian_unavailable');
    return matches[0];
}
export async function exchangeAfdian(env, code) {
    const data = await post(AFDIAN_OAUTH, new URLSearchParams({ grant_type: 'authorization_code',
        client_id: env.AFDIAN_CLIENT_ID, client_secret: env.AFDIAN_CLIENT_SECRET, code,
        redirect_uri: env.PUBLIC_ORIGIN + '/checkout.html' }).toString(), 'application/x-www-form-urlencoded');
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(data?.user_id || '')) throw Error('afdian_unavailable');
    return data.user_id;
}
