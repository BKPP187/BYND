import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const SANDBOX_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
const algorithm = 'RSA-SHA256';
export function canonical(parameters, notification = false) {
    return Object.keys(parameters).filter(key => key !== 'sign' && (!notification || key !== 'sign_type') && parameters[key] !== '')
        .sort().map(key => key + '=' + parameters[key]).join('&');
}
function key(value, type) {
    const bytes = Buffer.from(String(value || '').replace(/-----[^-]+-----|\s/g, ''), 'base64');
    const parsed = type === 'pkcs8' ? createPrivateKey({ key: bytes, type, format: 'der' }) : createPublicKey({ key: bytes, type, format: 'der' });
    if (parsed.asymmetricKeyType !== 'rsa' || parsed.asymmetricKeyDetails.modulusLength < 2048) throw Error('Invalid sandbox key');
    return parsed;
}
function timestamp(now) { return new Date(now * 1000 + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' '); }

// Keep the exact signed JSON bytes, including whitespace/escapes and property order.
// JSON.parse + JSON.stringify is not a valid way to reconstruct Alipay's signed payload.
export function envelope(text) {
    const parsed = JSON.parse(text), spans = new Map(); let index = 0;
    const space = () => { while (/\s/.test(text[index] || '') && index < text.length) index++; };
    function stringEnd() {
        const start = index++;
        while (index < text.length) {
            const char = text[index++]; if (char === '\\') index++; else if (char === '"') return text.slice(start, index);
        }
        throw Error('Invalid response');
    }
    function valueEnd() {
        if (text[index] === '"') { stringEnd(); return; }
        if (text[index] !== '{' && text[index] !== '[') { while (index < text.length && !/[,}\]\s]/.test(text[index])) index++; return; }
        const stack = [text[index++] === '{' ? '}' : ']'];
        while (index < text.length && stack.length) {
            const char = text[index];
            if (char === '"') stringEnd();
            else { index++; if (char === '{') stack.push('}'); else if (char === '[') stack.push(']'); else if (char === '}' || char === ']') { if (stack.pop() !== char) throw Error('Invalid response'); } }
        }
        if (stack.length) throw Error('Invalid response');
    }
    space(); if (text[index++] !== '{') throw Error('Invalid response'); space();
    while (text[index] !== '}') {
        if (text[index] !== '"') throw Error('Invalid response');
        const name = JSON.parse(stringEnd()); space(); if (text[index++] !== ':') throw Error('Invalid response'); space();
        const start = index; valueEnd(); if (spans.has(name)) throw Error('Duplicate response field'); spans.set(name, text.slice(start, index));
        space(); if (text[index] === '}') break; if (text[index++] !== ',') throw Error('Invalid response'); space();
    }
    index++; space(); if (index !== text.length) throw Error('Invalid response');
    return { parsed, spans };
}
async function boundedText(response) {
    const reader = response.body?.getReader(); if (!reader) throw Error('Empty response');
    const parts = []; let size = 0;
    while (true) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > 65536) { await reader.cancel(); throw Error('Response too large'); } parts.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts));
}
export function sandboxAlipay(env) {
    if (!/^\d{16}$/.test(env.ALIPAY_SANDBOX_APP_ID || '') || !/^2088\d{12}$/.test(env.ALIPAY_SANDBOX_SELLER_ID || '')) throw Error('Invalid sandbox configuration');
    const privateKey = key(env.ALIPAY_SANDBOX_PRIVATE_KEY, 'pkcs8'), publicKey = key(env.ALIPAY_SANDBOX_PUBLIC_KEY, 'spki');
    function parameters(method, bizContent, now, additional = {}) {
        const values = { app_id: env.ALIPAY_SANDBOX_APP_ID, method, format: 'JSON', charset: 'utf-8', sign_type: 'RSA2',
            timestamp: timestamp(now), version: '1.0', biz_content: JSON.stringify(bizContent), ...additional };
        values.sign = sign(algorithm, Buffer.from(canonical(values)), privateKey).toString('base64'); return values;
    }
    function verifySignature(content, signature) {
        return typeof signature === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(signature) && signature.length <= 1024 && verify(algorithm, Buffer.from(content), publicKey, Buffer.from(signature, 'base64'));
    }
    return {
        pageUrl(order, origin, now) {
            const values = parameters('alipay.trade.page.pay', { out_trade_no: order.order_no, seller_id: order.seller_id,
                total_amount: (order.amount_fen / 100).toFixed(2), subject: 'BYND 沙箱测试授权（非正式购买）', product_code: 'FAST_INSTANT_TRADE_PAY', timeout_express: '30m' }, now,
            { return_url: origin + '/checkout.html?order=' + order.id });
            return SANDBOX_GATEWAY + '?' + new URLSearchParams(values);
        },
        verifyNotification(parameters) { return parameters.sign_type === 'RSA2' && verifySignature(canonical(parameters, true), parameters.sign); },
        async query(orderNo, now) {
            const values = parameters('alipay.trade.query', { out_trade_no: orderNo }, now);
            const response = await fetch(SANDBOX_GATEWAY, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(12000),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: new URLSearchParams(values).toString() });
            if (!response.ok) throw Error('Sandbox query failed');
            const { parsed, spans } = envelope(await boundedText(response));
            const name = 'alipay_trade_query_response';
            if (!spans.has(name) || spans.has('error_response') || !verifySignature(spans.get(name), parsed.sign)) throw Error('Invalid sandbox response signature');
            const result = parsed[name]; if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('Invalid sandbox response');
            return result;
        }
    };
}
