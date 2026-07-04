const CODEX_PETS_ORIGIN = 'https://codex-pets.net';

export async function onRequest(context) {
  const { request, params } = context;
  if (request.method === 'OPTIONS') return withCors(null, 204);
  if (!['GET', 'HEAD'].includes(request.method)) {
    return withCors({ ok: false, error: 'method not allowed' }, 405);
  }

  const sourceUrl = new URL(request.url);
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  const targetUrl = new URL(`/${path}`, CODEX_PETS_ORIGIN);
  targetUrl.search = sourceUrl.search;

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: {
      'Accept': request.headers.get('Accept') || '*/*',
      'User-Agent': 'BYND-CodexPets-Proxy/1.0'
    },
    cf: {
      cacheTtl: path.startsWith('assets/') ? 86400 : 120,
      cacheEverything: path.startsWith('assets/')
    }
  });

  const headers = new Headers(upstream.headers);
  applyCors(headers);
  headers.set('Cache-Control', path.startsWith('assets/')
    ? 'public, max-age=86400'
    : 'public, max-age=120, stale-while-revalidate=300');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });
}

function withCors(payload, status = 200) {
  const headers = new Headers();
  applyCors(headers);
  if (payload === null) return new Response(null, { status, headers });
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(payload), { status, headers });
}

function applyCors(headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
