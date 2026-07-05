const TICKET_TTL_MS = 2 * 60 * 1000;
const FALLBACK_HOSTS = [
  'm701.music.126.net',
  'm801.music.126.net',
  'm7.music.126.net',
  'm8.music.126.net'
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return corsResponse(null, 204);

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return corsResponse({ ok: true, service: 'bynd-netease-audio-worker' });
      }
      if (request.method === 'POST' && url.pathname === '/netease/ticket') {
        return corsResponse(await createAudioTicket(request, env));
      }
      if (request.method === 'GET' && url.pathname === '/netease/audio') {
        return streamAudio(request, env);
      }
      return corsResponse({ ok: false, error: 'not found' }, 404);
    } catch (error) {
      return corsResponse({ ok: false, error: error.message || String(error) }, 500);
    }
  }
};

async function createAudioTicket(request, env) {
  const payload = await request.json();
  const id = String(payload.id || '').trim();
  const url = normalizeNeteaseAudioUrl(payload.url);
  const cookie = normalizeCookie(payload.cookie);
  if (!url) return { ok: false, error: 'invalid audio url' };
  if (!cookie) return { ok: false, error: 'missing cookie' };

  const token = await encryptTicket(env, {
    id,
    url,
    cookie,
    exp: Date.now() + TICKET_TTL_MS
  });
  return {
    ok: true,
    audioUrl: `${new URL(request.url).origin}/netease/audio?t=${encodeURIComponent(token)}`,
    expiresIn: Math.floor(TICKET_TTL_MS / 1000)
  };
}

async function streamAudio(request, env) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t') || '';
  const ticket = await decryptTicket(env, token);
  if (!ticket || Number(ticket.exp || 0) < Date.now()) {
    return corsResponse({ ok: false, error: 'ticket expired' }, 401);
  }

  const sourceUrl = normalizeNeteaseAudioUrl(ticket.url);
  const cookie = normalizeCookie(ticket.cookie);
  if (!sourceUrl || !cookie) return corsResponse({ ok: false, error: 'invalid ticket' }, 400);

  const response = await fetchWithCdnFallback(sourceUrl, cookie, request.headers.get('Range'));
  if (!response) return corsResponse({ ok: false, error: 'audio unavailable' }, 502);

  const headers = new Headers();
  copyHeader(response.headers, headers, 'content-type');
  copyHeader(response.headers, headers, 'content-length');
  copyHeader(response.headers, headers, 'content-range');
  copyHeader(response.headers, headers, 'accept-ranges');
  headers.set('Cache-Control', 'no-store');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type,Range');
  headers.set('Access-Control-Expose-Headers', 'Content-Length,Content-Range,Accept-Ranges');
  return new Response(response.body, { status: response.status, headers });
}

async function fetchWithCdnFallback(sourceUrl, cookie, range) {
  const urls = buildFallbackUrls(sourceUrl);
  for (const target of urls) {
    const headers = new Headers({
      Cookie: cookie,
      Referer: 'https://music.163.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
      Accept: 'audio/*,*/*;q=0.8'
    });
    if (range) headers.set('Range', range);
    try {
      const response = await fetch(target, { headers, redirect: 'follow' });
      if (response.ok || response.status === 206) return response;
      if (![403, 404, 429, 500, 502, 503, 504].includes(response.status)) return response;
    } catch (e) {}
  }
  return null;
}

function buildFallbackUrls(sourceUrl) {
  const parsed = new URL(sourceUrl);
  const hosts = [parsed.hostname, ...FALLBACK_HOSTS].filter((host, index, list) => host && list.indexOf(host) === index);
  return hosts.map(host => {
    const next = new URL(parsed.toString());
    next.hostname = host;
    return next.toString();
  });
}

function normalizeNeteaseAudioUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!/^https?:$/.test(url.protocol)) return '';
    if (!isAllowedNeteaseHost(url.hostname)) return '';
    url.protocol = 'https:';
    return url.toString();
  } catch (e) {
    return '';
  }
}

function isAllowedNeteaseHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'music.126.net' || host.endsWith('.music.126.net');
}

function normalizeCookie(value) {
  const cookie = String(value || '').trim();
  if (!cookie || cookie.length > 12000) return '';
  return cookie.replace(/[\r\n]/g, '');
}

async function encryptTicket(env, payload) {
  const key = await getAesKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `${base64urlEncode(iv)}.${base64urlEncode(new Uint8Array(encrypted))}`;
}

async function decryptTicket(env, token) {
  const [ivPart, dataPart] = String(token || '').split('.');
  if (!ivPart || !dataPart) return null;
  const key = await getAesKey(env);
  const iv = base64urlDecode(ivPart);
  const data = base64urlDecode(dataPart);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function getAesKey(env) {
  const secret = String(env.NETEASE_PROXY_SECRET || '').trim();
  if (!secret || secret.length < 24) throw new Error('missing NETEASE_PROXY_SECRET');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function base64urlEncode(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(value) {
  const padded = String(value || '').replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function copyHeader(from, to, name) {
  const value = from.get(name);
  if (value) to.set(name, value);
}

function corsResponse(data, status = 200) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Range',
    'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges'
  };
  if (data == null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}
