export async function onRequest(context) {
  const { request, params, env } = context;
  if (request.method === 'OPTIONS') return withCors(null, 204);

  const origin = String(env.BYND_PUSH_WORKER_ORIGIN || '').trim().replace(/\/+$/, '');
  if (!origin) {
    return withCors({ ok: false, error: 'missing BYND_PUSH_WORKER_ORIGIN' }, 500);
  }

  const sourceUrl = new URL(request.url);
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  const targetUrl = new URL(`/${path}`, origin);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('Host');
  headers.delete('Origin');
  headers.delete('Referer');

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body
  });

  const responseHeaders = new Headers(upstream.headers);
  applyCors(responseHeaders);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
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
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
