// Image generation relay.
// With a server-side IMAGE_API_KEY this Worker spends the operator's quota, so every
// such request must carry IMAGE_PROXY_TOKEN. Without a server key it only relays the
// caller's own key. Browser origins are limited either way; origin is not authentication.
const ALLOWED_ORIGINS = new Set(['https://bynd.ccwu.cc']);
const FORWARDED_HEADERS = ['Content-Type', 'Accept'];
const MAX_JSON_BYTES = 1024 * 1024;
const encoder = new TextEncoder();

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, url);
    if (origin && !cors['Access-Control-Allow-Origin']) {
      return withCors({ ok: false, error: 'origin not allowed' }, 403, cors);
    }
    if (request.method === 'OPTIONS') return withCors(null, 204, cors);
    if (url.pathname === '/' || url.pathname === '/health') {
      return withCors({ ok: true, service: 'bynd-image-worker' }, 200, cors);
    }
    if (!['/images/generations', '/images/edits'].includes(url.pathname)) {
      return withCors({ ok: false, error: 'not found' }, 404, cors);
    }
    if (request.method !== 'POST') return withCors({ ok: false, error: 'method not allowed' }, 405, cors);

    const supplied = request.headers.get('Authorization') || '';
    const upstreamKey = String(env.IMAGE_API_KEY || '').trim();
    let authorization;
    if (upstreamKey) {
      const proxyToken = String(env.IMAGE_PROXY_TOKEN || '');
      // Refuse to run as an open relay for the operator's key.
      if (proxyToken.length < 32) return withCors({ ok: false, error: 'image proxy not configured' }, 503, cors);
      if (!(await sameSecret(supplied, 'Bearer ' + proxyToken))) {
        return withCors({ ok: false, error: 'unauthorized' }, 401, cors);
      }
      authorization = 'Bearer ' + upstreamKey;
    } else {
      if (!/^Bearer\s+\S+$/i.test(supplied)) return withCors({ ok: false, error: 'missing api key' }, 401, cors);
      authorization = supplied;
    }

    const upstreamBase = String(env.IMAGE_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const upstreamModel = String(env.IMAGE_API_MODEL || '').trim();
    // Forward only API headers; cookies and browser metadata stay here.
    const headers = new Headers({ Authorization: authorization });
    for (const name of FORWARDED_HEADERS) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }

    const contentType = headers.get('content-type') || '';
    let body = request.body;
    if (upstreamModel && contentType.includes('application/json')) {
      let json;
      try {
        const raw = await request.text();
        if (encoder.encode(raw).length > MAX_JSON_BYTES) return withCors({ ok: false, error: 'request too large' }, 413, cors);
        json = JSON.parse(raw);
      } catch (_) {
        return withCors({ ok: false, error: 'invalid json' }, 400, cors);
      }
      if (!json || typeof json !== 'object' || Array.isArray(json)) return withCors({ ok: false, error: 'invalid json' }, 400, cors);
      json.model = upstreamModel;
      body = JSON.stringify(json);
      headers.set('content-type', 'application/json');
    }

    let response;
    try {
      response = await fetch(upstreamBase + url.pathname, { method: 'POST', headers, body, redirect: 'manual' });
    } catch (_) {
      return withCors({ ok: false, error: 'upstream request failed' }, 502, cors);
    }
    const responseHeaders = new Headers();
    const type = response.headers.get('Content-Type');
    if (type) responseHeaders.set('Content-Type', type);
    Object.entries(cors).forEach(([key, value]) => responseHeaders.set(key, value));
    responseHeaders.set('Cache-Control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  }
};

function corsHeaders(origin, url) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
  if (origin && (origin === url.origin || ALLOWED_ORIGINS.has(origin))) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

async function sameSecret(left, right) {
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(left)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(right)));
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

function withCors(payload, status, cors) {
  const body = payload == null ? null : JSON.stringify(payload);
  const headers = { ...cors };
  if (body !== null) headers['Content-Type'] = 'application/json; charset=utf-8';
  return new Response(body, { status, headers });
}
