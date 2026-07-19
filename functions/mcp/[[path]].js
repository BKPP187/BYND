// Production bynd.ccwu.cc MCP traffic is handled by workers/bynd-push-worker.js.
// Keep this Cloudflare Pages fallback synchronized with the Worker's security rules.
const ALLOWED_METHODS = ['POST', 'DELETE'];
const MAX_REQUEST_BYTES = 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
  'https://bynd.ccwu.cc',
  'null'
]);
const FORWARDED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Accept',
  'MCP-Protocol-Version',
  'Mcp-Session-Id',
  'X-MCP-Toolsets',
  'X-MCP-Tools',
  'X-MCP-Readonly',
  'X-MCP-Lockdown',
  'X-MCP-Insiders'
];

export async function onRequest({ request }) {
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get('Origin');

  if (!isAllowedOrigin(requestOrigin, requestUrl)) {
    return jsonResponse(requestUrl, requestOrigin, 403, 'cross-origin requests are not allowed');
  }

  if (request.method === 'OPTIONS') {
    const requestedMethod = request.headers.get('Access-Control-Request-Method');
    if (requestedMethod && !ALLOWED_METHODS.includes(requestedMethod.toUpperCase())) {
      return jsonResponse(requestUrl, requestOrigin, 405, 'method not allowed', {
        Allow: 'POST, DELETE, OPTIONS'
      });
    }
    return createResponse(null, 204, requestUrl, requestOrigin);
  }

  if (!ALLOWED_METHODS.includes(request.method)) {
    return jsonResponse(requestUrl, requestOrigin, 405, 'method not allowed', {
      Allow: 'POST, DELETE, OPTIONS'
    });
  }

  let upstreamBody;
  if (request.method === 'POST') {
    if (!isJsonContentType(request.headers.get('Content-Type'))) {
      return jsonResponse(requestUrl, requestOrigin, 415, 'content type must be application/json');
    }
    try {
      upstreamBody = await readRequestBody(request, MAX_REQUEST_BYTES);
    } catch (error) {
      return jsonResponse(requestUrl, requestOrigin, error?.status === 413 ? 413 : 400, error?.message || 'unable to read request body');
    }
  }

  const targetValues = requestUrl.searchParams.getAll('url');
  if (targetValues.length !== 1) {
    return jsonResponse(requestUrl, requestOrigin, 400, 'exactly one url query parameter is required');
  }

  const targetUrl = parseTargetUrl(targetValues[0]);
  if (!targetUrl) {
    return jsonResponse(requestUrl, requestOrigin, 400, 'target url is not allowed');
  }

  const upstreamHeaders = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) upstreamHeaders.set(name, value);
  }

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: upstreamBody,
      redirect: 'manual'
    });
  } catch {
    return jsonResponse(requestUrl, requestOrigin, 502, 'upstream request failed');
  }

  const responseHeaders = new Headers();
  copyHeader(upstream.headers, responseHeaders, 'Content-Type');
  copyHeader(upstream.headers, responseHeaders, 'Mcp-Session-Id');

  return createResponse(
    upstream.body,
    upstream.status,
    requestUrl,
    requestOrigin,
    responseHeaders,
    upstream.statusText
  );
}

function parseTargetUrl(value) {
  if (!value || value !== value.trim()) return null;

  let targetUrl;
  try {
    targetUrl = new URL(value);
  } catch {
    return null;
  }

  if (
    targetUrl.protocol !== 'https:' ||
    targetUrl.username ||
    targetUrl.password ||
    targetUrl.port ||
    targetUrl.hash
  ) {
    return null;
  }

  const hostname = targetUrl.hostname.toLowerCase();
  const isGitHubCopilot = hostname === 'api.githubcopilot.com';
  const isGheCopilot = /^copilot-api\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.ghe\.com$/.test(hostname);
  const isMcpPath = targetUrl.pathname === '/mcp' || targetUrl.pathname.startsWith('/mcp/');

  return isMcpPath && (isGitHubCopilot || isGheCopilot) ? targetUrl : null;
}

function copyHeader(source, destination, name) {
  const value = source.get(name);
  if (value !== null) destination.set(name, value);
}

function jsonResponse(requestUrl, requestOrigin, status, error, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return createResponse(JSON.stringify({ ok: false, error }), status, requestUrl, requestOrigin, headers);
}

function createResponse(body, status, requestUrl, requestOrigin, headers = new Headers(), statusText) {
  applyCors(headers, requestUrl, requestOrigin);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');

  return new Response(body, { status, statusText, headers });
}

function applyCors(headers, requestUrl, requestOrigin) {
  if (requestOrigin && isAllowedOrigin(requestOrigin, requestUrl)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
  }
  headers.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', FORWARDED_HEADERS.join(', '));
  headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  headers.append('Vary', 'Origin');
}

function isAllowedOrigin(requestOrigin, requestUrl) {
  return !!requestOrigin && (requestOrigin === requestUrl.origin || ALLOWED_ORIGINS.has(requestOrigin));
}

function isJsonContentType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

async function readRequestBody(request, maxBytes) {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw Object.assign(new Error('request body too large'), { status: 413 });
  }
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
    total += chunk.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch (error) {}
      throw Object.assign(new Error('request body too large'), { status: 413 });
    }
    chunks.push(chunk);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  chunks.forEach(chunk => {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return body;
}
