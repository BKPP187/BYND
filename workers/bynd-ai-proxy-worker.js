const DEFAULT_UPSTREAM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

    try {
      const url = new URL(request.url);
      if (url.pathname === '/' || url.pathname === '/health') {
        return json({ ok: true, service: 'bynd-ai-proxy-worker' });
      }

      if (!['GET', 'POST'].includes(request.method)) {
        return json({ ok: false, error: 'method not allowed' }, 405);
      }

      const upstreamBase = String(env.UPSTREAM_API_BASE_URL || DEFAULT_UPSTREAM_BASE_URL).replace(/\/+$/, '');
      const auth = request.headers.get('Authorization') || '';
      if (!/^Bearer\s+\S+/i.test(auth)) {
        return json({ ok: false, error: 'missing Authorization bearer token' }, 401);
      }

      const path = normalizeProxyPath(url.pathname, upstreamBase);
      if (!['/models', '/chat/completions', '/completions', '/embeddings'].includes(path)) {
        return json({ ok: false, error: 'unsupported endpoint' }, 404);
      }

      const target = new URL(upstreamBase + path);
      target.search = url.search;

      const headers = new Headers(request.headers);
      headers.set('Authorization', auth);
      headers.set('Accept', request.headers.get('Accept') || 'application/json');
      headers.delete('Host');
      headers.delete('Origin');
      headers.delete('Referer');

      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: request.method === 'GET' ? undefined : request.body
      });

      const responseHeaders = new Headers(upstream.headers);
      Object.entries(CORS_HEADERS).forEach(([key, value]) => responseHeaders.set(key, value));
      responseHeaders.delete('Content-Security-Policy');
      responseHeaders.delete('Content-Security-Policy-Report-Only');

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders
      });
    } catch (error) {
      return json({ ok: false, error: error.message || String(error) }, 500);
    }
  }
};

function normalizeProxyPath(pathname, upstreamBase) {
  let path = String(pathname || '/').replace(/\/+/g, '/');
  if (path.startsWith('/v1/') && /\/v1$/i.test(upstreamBase)) path = path.slice(3);
  return path;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}
