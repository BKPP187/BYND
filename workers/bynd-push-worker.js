const DEFAULT_INTERVAL_HOURS = 24;
const MIN_INTERVAL_HOURS = 0.1;
const MAX_INTERVAL_HOURS = 720;
const FONT_PROXY_MAX_BYTES = 50 * 1024 * 1024;
const FONT_PROXY_ALLOWED_HOSTS = new Set([
  'files.catbox.moe',
  'litter.catbox.moe',
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com'
]);
const FONT_PROXY_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2', '.ttc'];
const MCP_ALLOWED_METHODS = new Set(['POST', 'DELETE']);
const MCP_MAX_REQUEST_BYTES = 1024 * 1024;
const MCP_ALLOWED_ORIGINS = new Set([
  'https://bynd.ccwu.cc',
  'null'
]);
const MCP_FORWARDED_HEADERS = [
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/mcp/bridge') {
        return proxyGitHubMcp(request, url);
      }
      if (url.pathname.startsWith('/mcp/')) {
        return mcpJsonResponse(url, request.headers.get('Origin'), 404, 'not found');
      }
      if (request.method === 'OPTIONS') return corsResponse(null, 204);
      if (request.method === 'POST' && url.pathname === '/subscribe') {
        return corsResponse(await handleSubscribe(request, env));
      }
      if (request.method === 'POST' && url.pathname === '/contact') {
        return corsResponse(await handleContact(request, env));
      }
      if (request.method === 'POST' && url.pathname === '/tick') {
        await runProactiveTick(env);
        return corsResponse({ ok: true });
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        return corsResponse({ ok: true, service: 'bynd-push-worker' });
      }
      if (request.method === 'GET' && url.pathname.startsWith('/codex-pets/')) {
        return proxyCodexPets(request, url);
      }
      if (request.method === 'GET' && url.pathname === '/font-proxy') {
        return proxyRemoteFont(request, url);
      }
      return corsResponse({ ok: false, error: 'not found' }, 404);
    } catch (error) {
      if (url.pathname.startsWith('/mcp/')) {
        return mcpJsonResponse(url, request.headers.get('Origin'), 500, 'proxy request failed');
      }
      return corsResponse({ ok: false, error: error.message || String(error) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runProactiveTick(env));
  }
};

async function proxyGitHubMcp(request, requestUrl) {
  const requestOrigin = request.headers.get('Origin');
  if (!isAllowedMcpOrigin(requestOrigin, requestUrl)) {
    return mcpJsonResponse(requestUrl, requestOrigin, 403, 'origin not allowed');
  }

  if (request.method === 'OPTIONS') {
    const requestedMethod = String(request.headers.get('Access-Control-Request-Method') || '').toUpperCase();
    if (requestedMethod && !MCP_ALLOWED_METHODS.has(requestedMethod)) {
      return mcpJsonResponse(requestUrl, requestOrigin, 405, 'method not allowed', { Allow: 'POST, DELETE, OPTIONS' });
    }
    return mcpResponse(null, 204, requestUrl, requestOrigin);
  }

  if (!MCP_ALLOWED_METHODS.has(request.method)) {
    return mcpJsonResponse(requestUrl, requestOrigin, 405, 'method not allowed', { Allow: 'POST, DELETE, OPTIONS' });
  }

  let upstreamBody;
  if (request.method === 'POST') {
    if (!isMcpJsonContentType(request.headers.get('Content-Type'))) {
      return mcpJsonResponse(requestUrl, requestOrigin, 415, 'content type must be application/json');
    }
    try {
      upstreamBody = await readMcpRequestBody(request, MCP_MAX_REQUEST_BYTES);
    } catch (error) {
      return mcpJsonResponse(requestUrl, requestOrigin, error?.status === 413 ? 413 : 400, error?.message || 'unable to read request body');
    }
  }

  const targetValues = requestUrl.searchParams.getAll('url');
  if (targetValues.length !== 1) {
    return mcpJsonResponse(requestUrl, requestOrigin, 400, 'exactly one url query parameter is required');
  }
  const targetUrl = normalizeGitHubMcpTargetUrl(targetValues[0]);
  if (!targetUrl) {
    return mcpJsonResponse(requestUrl, requestOrigin, 400, 'target url is not allowed');
  }

  const upstreamHeaders = new Headers();
  MCP_FORWARDED_HEADERS.forEach(name => {
    const value = request.headers.get(name);
    if (value !== null) upstreamHeaders.set(name, value);
  });

  let upstream;
  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      body: upstreamBody,
      redirect: 'manual'
    });
  } catch (error) {
    return mcpJsonResponse(requestUrl, requestOrigin, 502, 'upstream request failed');
  }

  const responseHeaders = new Headers();
  copyMcpHeader(upstream.headers, responseHeaders, 'Content-Type');
  copyMcpHeader(upstream.headers, responseHeaders, 'Mcp-Session-Id');
  return mcpResponse(upstream.body, upstream.status, requestUrl, requestOrigin, responseHeaders, upstream.statusText);
}

function normalizeGitHubMcpTargetUrl(value) {
  if (!value || value !== value.trim()) return null;
  let targetUrl;
  try {
    targetUrl = new URL(value);
  } catch (error) {
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
  const isOfficial = hostname === 'api.githubcopilot.com';
  const isEnterprise = /^copilot-api\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.ghe\.com$/.test(hostname);
  const isMcpPath = targetUrl.pathname === '/mcp' || targetUrl.pathname.startsWith('/mcp/');
  return isMcpPath && (isOfficial || isEnterprise) ? targetUrl : null;
}

function isAllowedMcpOrigin(requestOrigin, requestUrl) {
  return !!requestOrigin && (requestOrigin === requestUrl.origin || MCP_ALLOWED_ORIGINS.has(requestOrigin));
}

function isMcpJsonContentType(value) {
  return String(value || '').split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

async function readMcpRequestBody(request, maxBytes) {
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

function copyMcpHeader(source, destination, name) {
  const value = source.get(name);
  if (value !== null) destination.set(name, value);
}

function mcpJsonResponse(requestUrl, requestOrigin, status, error, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return mcpResponse(JSON.stringify({ ok: false, error }), status, requestUrl, requestOrigin, headers);
}

function mcpResponse(body, status, requestUrl, requestOrigin, headers = new Headers(), statusText) {
  if (requestOrigin && isAllowedMcpOrigin(requestOrigin, requestUrl)) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
  }
  headers.set('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', MCP_FORWARDED_HEADERS.join(', '));
  headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.append('Vary', 'Origin');
  return new Response(body, { status, statusText, headers });
}

async function handleSubscribe(request, env) {
  const payload = await request.json();
  const clientId = normalizeClientId(payload.clientId);
  const record = normalizeRecord(payload);
  await putRecord(env, clientId, record);
  return { ok: true, clientId };
}

async function proxyCodexPets(request, url) {
  const upstreamPath = url.pathname.replace(/^\/codex-pets/, '') || '/';
  if (!isAllowedCodexPetsPath(upstreamPath)) {
    return corsResponse({ ok: false, error: 'codex pets path not allowed' }, 403);
  }

  const upstreamUrl = new URL(`https://codex-pets.net${upstreamPath}${url.search}`);
  const headers = new Headers({
    Accept: request.headers.get('Accept') || '*/*',
    'User-Agent': request.headers.get('User-Agent') || 'BYND/1.0'
  });
  const range = request.headers.get('Range');
  if (range) headers.set('Range', range);

  const response = await fetch(upstreamUrl.toString(), {
    method: 'GET',
    headers,
    redirect: 'follow',
    cf: { cacheEverything: true, cacheTtl: upstreamPath.startsWith('/api/') ? 60 : 86400 }
  });

  const responseHeaders = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([key, value]) => responseHeaders.set(key, value));
  responseHeaders.set('Cache-Control', upstreamPath.startsWith('/api/') ? 'public, max-age=60' : 'public, max-age=86400');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

function isAllowedCodexPetsPath(path) {
  return /^\/api\/pets(?:\/|$|\?)/.test(path)
    || /^\/assets\/pets\//.test(path)
    || /^\/assets\/petshare-/.test(path);
}

async function proxyRemoteFont(request, url) {
  const target = normalizeFontProxyUrl(url.searchParams.get('url'));
  if (!target) return corsResponse({ ok: false, error: 'font url not allowed' }, 403);

  const response = await fetch(target, {
    method: 'GET',
    headers: {
      Accept: 'font/ttf,font/otf,font/woff,font/woff2,application/octet-stream,*/*;q=0.8',
      'User-Agent': request.headers.get('User-Agent') || 'BYND/1.0'
    },
    redirect: 'follow',
    cf: { cacheEverything: true, cacheTtl: 86400 }
  });

  if (!response.ok) {
    return corsResponse({ ok: false, error: `font fetch ${response.status}` }, response.status === 404 ? 404 : 502);
  }

  const length = Number(response.headers.get('content-length') || 0);
  if (length > FONT_PROXY_MAX_BYTES) {
    return corsResponse({ ok: false, error: 'font too large' }, 413);
  }
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (/text\/html|application\/json/.test(contentType)) {
    return corsResponse({ ok: false, error: 'not a font file' }, 415);
  }

  const headers = new Headers(corsHeaders());
  headers.set('Content-Type', getFontContentType(target.pathname));
  if (length) headers.set('Content-Length', String(length));
  headers.set('Cache-Control', 'public, max-age=86400');
  return new Response(response.body, { status: 200, headers });
}

function normalizeFontProxyUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:') return null;
    if (!FONT_PROXY_ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
    const path = url.pathname.toLowerCase();
    if (!FONT_PROXY_EXTENSIONS.some(ext => path.endsWith(ext))) return null;
    return url;
  } catch (e) {
    return null;
  }
}

function getFontContentType(pathname) {
  const path = String(pathname || '').toLowerCase();
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.otf')) return 'font/otf';
  return 'font/ttf';
}

async function handleContact(request, env) {
  const payload = await request.json();
  const clientId = normalizeClientId(payload.clientId);
  const record = await getRecord(env, clientId);
  if (!record) return { ok: false, error: 'subscription not found' };

  const charId = String(payload.charId || '').trim();
  if (!charId) return { ok: false, error: 'missing charId' };

  record.state = record.state || { lastContact: {}, lastSent: {} };
  record.state.lastContact = record.state.lastContact || {};
  record.state.lastContact[charId] = Number(payload.contactedAt) || Date.now();

  if (payload.charName) {
    const existing = Array.isArray(record.chars) ? record.chars : [];
    const index = existing.findIndex(char => char.id === charId);
    const nextChar = {
      id: charId,
      name: String(payload.charName).slice(0, 80),
      avatar: ''
    };
    if (index >= 0) existing[index] = { ...existing[index], ...nextChar };
    else existing.push(nextChar);
    record.chars = existing.slice(0, 40);
  }

  record.updatedAt = Date.now();
  await putRecord(env, clientId, record);
  return { ok: true };
}

async function runProactiveTick(env) {
  const records = await listRecords(env);
  await Promise.all(records.map(record => maybeSendRecord(env, record)));
}

async function maybeSendRecord(env, record) {
  if (!record || !record.subscription || !record.settings || !record.settings.enabled) return;

  const chars = pickNotifyChars(record);
  if (!chars.length) return;

  const now = Date.now();
  const state = record.state || { lastContact: {}, lastSent: {} };
  state.lastContact = state.lastContact || {};
  state.lastSent = state.lastSent || {};

  let changed = false;
  const intervalMs = clampNumber(record.settings.intervalHours, DEFAULT_INTERVAL_HOURS, MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS) * 60 * 60 * 1000;
  const minSentGap = Math.max(intervalMs * 0.75, 30 * 60 * 1000);

  for (const char of chars) {
    const lastContact = state.lastContact[char.id] || 0;
    const lastSent = state.lastSent[char.id] || 0;
    if ((lastContact && now - lastContact < intervalMs) || (lastSent && now - lastSent < minSentGap)) continue;

    const ok = await sendWebPush(env, record.subscription);
    if (ok) {
      state.lastSent[char.id] = now;
      changed = true;
    }
  }

  if (changed) {
    record.state = state;
    record.updatedAt = now;
    await putRecord(env, record.clientId, record);
  }
}

function normalizeRecord(payload) {
  const settings = payload.settings || {};
  return {
    clientId: normalizeClientId(payload.clientId),
    subscription: payload.subscription,
    settings: {
      enabled: !!settings.enabled,
      charId: String(settings.charId || 'current'),
      intervalHours: clampNumber(settings.intervalHours, DEFAULT_INTERVAL_HOURS, MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS)
    },
    state: payload.state || { lastContact: {}, lastSent: {} },
    chars: Array.isArray(payload.chars) ? payload.chars.slice(0, 40).map(normalizeChar).filter(Boolean) : [],
    origin: String(payload.origin || ''),
    url: String(payload.url || ''),
    updatedAt: Date.now()
  };
}

function normalizeChar(char) {
  if (!char || !char.id) return null;
  return {
    id: String(char.id),
    name: String(char.name || 'AI').slice(0, 80),
    avatar: String(char.avatar || '')
  };
}

function pickNotifyChars(record) {
  const chars = Array.isArray(record.chars) ? record.chars : [];
  const charId = record.settings.charId || 'current';
  if (charId === 'all') return chars;
  if (charId === 'current') return chars.slice(0, 1);
  return chars.filter(char => char.id === charId);
}

async function sendWebPush(env, subscription) {
  if (!subscription || !subscription.endpoint) return false;
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) throw new Error('missing VAPID keys');

  const endpoint = new URL(subscription.endpoint);
  const jwt = await createVapidJwt(endpoint.origin, subject, publicKey, privateKey);
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      Urgency: 'normal',
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      'Content-Length': '0'
    }
  });
  return response.ok || response.status === 201 || response.status === 202;
}

async function createVapidJwt(audience, subject, publicKey, privateKey) {
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject
  };
  const input = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const key = await importVapidPrivateKey(publicKey, privateKey);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(input));
  return `${input}.${base64UrlEncode(derToJose(new Uint8Array(signature)))}`;
}

async function importVapidPrivateKey(publicKey, privateKey) {
  const publicBytes = base64UrlDecode(publicKey);
  const x = publicBytes.length === 65 && publicBytes[0] === 4 ? publicBytes.slice(1, 33) : publicBytes.slice(0, 32);
  const y = publicBytes.length === 65 && publicBytes[0] === 4 ? publicBytes.slice(33, 65) : publicBytes.slice(32, 64);
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    d: privateKey,
    ext: false
  };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

function derToJose(signature) {
  if (signature.length === 64) return signature;
  let offset = 3;
  const rLength = signature[offset++];
  let r = signature.slice(offset, offset + rLength);
  offset += rLength + 1;
  const sLength = signature[offset++];
  let s = signature.slice(offset, offset + sLength);
  r = trimAndPad(r, 32);
  s = trimAndPad(s, 32);
  const out = new Uint8Array(64);
  out.set(r, 0);
  out.set(s, 32);
  return out;
}

function trimAndPad(bytes, length) {
  while (bytes.length > length && bytes[0] === 0) bytes = bytes.slice(1);
  if (bytes.length === length) return bytes;
  const out = new Uint8Array(length);
  out.set(bytes, length - bytes.length);
  return out;
}

async function getRecord(env, clientId) {
  const raw = await env.BYND_PUSH.get(keyFor(clientId));
  return raw ? JSON.parse(raw) : null;
}

async function putRecord(env, clientId, record) {
  await env.BYND_PUSH.put(keyFor(clientId), JSON.stringify({ ...record, clientId }));
}

async function listRecords(env) {
  const out = [];
  let cursor;
  do {
    const page = await env.BYND_PUSH.list({ prefix: 'sub:', cursor });
    cursor = page.cursor;
    const rows = await Promise.all(page.keys.map(key => env.BYND_PUSH.get(key.name)));
    rows.forEach(raw => {
      if (!raw) return;
      try { out.push(JSON.parse(raw)); } catch (e) {}
    });
  } while (cursor);
  return out;
}

function keyFor(clientId) {
  return `sub:${normalizeClientId(clientId)}`;
}

function normalizeClientId(value) {
  const id = String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  if (!id) throw new Error('missing clientId');
  return id;
}

function clampNumber(value, fallback, min, max) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, next));
}

function corsResponse(payload, status = 200) {
  const headers = { ...corsHeaders(), 'Content-Type': 'application/json' };
  if (payload === null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(payload), { status, headers });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Range',
    'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges'
  };
}

function base64UrlJson(value) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncode(bytes) {
  let binary = '';
  bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
