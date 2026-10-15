const DEFAULT_UPSTREAM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
const ALLOWED_ORIGINS = new Set(['https://bynd.ccwu.cc', 'null']);

export default {
  async fetch(request, env = {}) {
    const origin = request.headers.get('Origin');
    const url = new URL(request.url);
    const allowed = !!origin && (origin === url.origin || ALLOWED_ORIGINS.has(origin));
    const cors = { ...CORS_HEADERS, Vary: 'Origin' };
    if (allowed) cors['Access-Control-Allow-Origin'] = origin;
    const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
    // Origin checks constrain browser clients; they do not replace API-key auth.
    // "null" is retained for the APK's file:// entry point, as in the MCP proxy.
    if (!allowed && !(request.method === 'GET' && ['/', '/health'].includes(url.pathname) && !origin)) return json({ ok: false, error: 'origin not allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
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

      // Forward only API headers; app cookies and browser metadata stay here.
      const headers = new Headers();
      headers.set('Authorization', auth);
      headers.set('Accept', request.headers.get('Accept') || 'application/json');
      if (request.headers.has('Content-Type')) headers.set('Content-Type', request.headers.get('Content-Type'));

      const upstream = await fetch(target, {
        method: request.method,
        headers,
        body: request.method === 'GET' ? undefined : request.body
      });

      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete('Access-Control-Allow-Origin');
      Object.entries(cors).forEach(([key, value]) => responseHeaders.set(key, value));
      const vary = new Set((upstream.headers.get('Vary') || '').split(',').map(value => value.trim()).filter(Boolean));
      vary.add('Origin'); responseHeaders.set('Vary', [...vary].join(', '));
      responseHeaders.set('Cache-Control', 'no-store');
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
