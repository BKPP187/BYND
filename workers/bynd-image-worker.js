const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type',
  'Access-Control-Max-Age': '86400'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return withCors(null, 204);
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return withCors({ ok: true, service: 'bynd-image-worker' });
    }
    if (!['/images/generations', '/images/edits'].includes(url.pathname)) {
      return withCors({ ok: false, error: 'not found' }, 404);
    }
    if (request.method !== 'POST') return withCors({ ok: false, error: 'method not allowed' }, 405);

    const upstreamBase = String(env.IMAGE_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const upstreamKey = String(env.IMAGE_API_KEY || '').trim();
    const upstreamModel = String(env.IMAGE_API_MODEL || '').trim();
    const upstreamUrl = upstreamBase + url.pathname;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('origin');
    headers.delete('referer');
    headers.delete('content-length');
    if (upstreamKey) headers.set('Authorization', `Bearer ${upstreamKey}`);

    const contentType = headers.get('content-type') || '';
    let body = request.body;
    if (upstreamModel && contentType.includes('application/json')) {
      const json = await request.json();
      json.model = upstreamModel;
      body = JSON.stringify(json);
      headers.set('content-type', 'application/json');
    }

    const response = await fetch(upstreamUrl, {
      method: 'POST',
      headers,
      body
    });
    const responseHeaders = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([key, value]) => responseHeaders.set(key, value));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  }
};

function withCors(payload, status = 200) {
  const body = payload == null ? null : JSON.stringify(payload);
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
