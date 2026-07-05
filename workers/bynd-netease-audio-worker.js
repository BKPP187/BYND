const TICKET_TTL_MS = 2 * 60 * 1000;
const FALLBACK_HOSTS = [
  'm701.music.126.net',
  'm801.music.126.net',
  'm7.music.126.net',
  'm8.music.126.net'
];
const NETEASE_WEB_ORIGIN = 'https://music.163.com';
const NETEASE_API_ORIGIN = 'https://interface.music.163.com';
const NETEASE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const NETEASE_API_USER_AGENT = 'NeteaseMusic 9.0.90/5038 (iPhone; iOS 16.2; zh_CN)';
const NETEASE_PC_COOKIE = {
  os: 'pc',
  appver: '3.1.17.204416',
  osver: 'Microsoft-Windows-10-Professional-build-19045-64bit',
  channel: 'netease'
};
const WEAPI_PRESET_KEY = '0CoJUm6Qyw8W8jud';
const WEAPI_IV = '0102030405060708';
const WEAPI_PUBLIC_KEY = '010001';
const WEAPI_MODULUS = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const routePath = normalizeWorkerPath(url.pathname);
    if (request.method === 'OPTIONS') return corsResponse(null, 204);

    try {
      if (request.method === 'GET' && routePath === '/health') {
        return corsResponse({ ok: true, service: 'bynd-netease-audio-worker' });
      }
      if (request.method === 'POST' && routePath === '/ticket') {
        return corsResponse(await createAudioTicket(request, env));
      }
      if (request.method === 'GET' && routePath === '/audio') {
        return streamAudio(request, env);
      }
      if (routePath === '/api' || routePath.startsWith('/api/')) {
        return proxyNeteaseApi(request, env, url, routePath);
      }
      return corsResponse({ ok: false, error: 'not found' }, 404);
    } catch (error) {
      return corsResponse({ ok: false, error: error.message || String(error) }, 500);
    }
  }
};

function normalizeWorkerPath(pathname) {
  const clean = pathname || '/';
  if (clean === '/netease') return '/';
  if (clean.startsWith('/netease/')) return clean.slice('/netease'.length) || '/';
  return clean;
}

async function proxyNeteaseApi(request, env, url, routePath) {
  if (!['GET', 'POST'].includes(request.method)) {
    return corsResponse({ ok: false, error: 'method not allowed' }, 405);
  }

  const upstreamBase = getNeteaseApiUpstream(env);
  const upstreamPath = routePath.replace(/^\/api/, '') || '/';
  if (!isAllowedNeteaseApiPath(upstreamPath)) {
    return corsResponse({ ok: false, error: 'netease api path not allowed' }, 403);
  }
  if (!upstreamBase) return corsResponse(await handleNeteaseApiDirect(upstreamPath, url, request));

  const target = buildNeteaseApiUrl(upstreamBase, upstreamPath, url.search);
  const headers = new Headers({
    Accept: request.headers.get('Accept') || 'application/json,text/plain,*/*',
    'User-Agent': request.headers.get('User-Agent') || 'BYND/1.0'
  });
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);

  const response = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: request.method === 'POST' ? request.body : undefined,
    redirect: 'follow'
  });

  const responseHeaders = new Headers();
  copyHeader(response.headers, responseHeaders, 'content-type');
  copyHeader(response.headers, responseHeaders, 'content-length');
  responseHeaders.set('Cache-Control', 'no-store');
  Object.entries(corsHeaders()).forEach(([key, value]) => responseHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

function getNeteaseApiUpstream(env) {
  return String(env.NETEASE_API_UPSTREAM || env.NETEASE_API_BASE || '').trim().replace(/\/+$/, '');
}

function buildNeteaseApiUrl(upstreamBase, upstreamPath, search) {
  const base = new URL(`${upstreamBase}/`);
  const basePath = base.pathname.replace(/\/+$/, '');
  base.pathname = `${basePath}${upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`}`;
  base.search = search || '';
  return base;
}

function isAllowedNeteaseApiPath(path) {
  return /^\/login\/qr\/(?:key|create|check)$/.test(path)
    || path === '/login/status'
    || path === '/logout'
    || path === '/user/playlist'
    || path === '/likelist'
    || path === '/song/detail'
    || path === '/playlist/track/all'
    || path === '/lyric'
    || /^\/song\/url(?:\/v1)?$/.test(path);
}

async function handleNeteaseApiDirect(path, url, request) {
  const params = url.searchParams;
  const cookie = normalizeCookie(params.get('cookie') || request.headers.get('Cookie') || '');

  if (path === '/login/qr/key') {
    const { json, cookie: qrCookie } = await neteasePlainApiRequest('/api/login/qrcode/unikey', { type: 3 }, cookie);
    const unikey = json?.data?.unikey || json?.unikey || '';
    const sessionCookie = createNeteaseClientCookie(mergeCookieStrings(cookie, qrCookie));
    if (unikey && sessionCookie) await storeNeteaseQrCookie(unikey, sessionCookie);
    return {
      ...json,
      code: json?.code || 200,
      cookie: sessionCookie || qrCookie || undefined,
      data: {
        ...(json?.data || {}),
        unikey,
        cookie: sessionCookie || qrCookie || undefined
      }
    };
  }

  if (path === '/login/qr/create') {
    const key = String(params.get('key') || '').trim();
    if (!key) return { code: 400, message: 'missing key' };
    const platform = String(params.get('platform') || 'web').trim().toLowerCase();
    const qrCookie = createNeteaseClientCookie(cookie || await getNeteaseQrCookie(key));
    if (qrCookie) await storeNeteaseQrCookie(key, qrCookie);
    const qr = new URL(`${NETEASE_WEB_ORIGIN}/login`);
    qr.searchParams.set('codekey', key);
    if (platform === 'web') qr.searchParams.set('chainId', createNeteaseChainId(qrCookie));
    const qrurl = qr.toString();
    const qrimg = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(qrurl)}`;
    return { code: 200, data: { qrurl, qrimg } };
  }

  if (path === '/login/qr/check') {
    const key = String(params.get('key') || '').trim();
    if (!key) return { code: 400, message: 'missing key' };
    const qrCookie = createNeteaseClientCookie(cookie || await getNeteaseQrCookie(key));
    const { json, cookie: loginCookie } = await neteasePlainApiRequest('/api/login/qrcode/client/login', {
      key,
      type: 3
    }, qrCookie);
    if (Number(json?.code) === 803) json.cookie = mergeCookieStrings(qrCookie, loginCookie, json?.cookie);
    return json;
  }

  if (path === '/login/status') {
    const { json } = await neteaseWeapiRequest('/w/nuser/account/get', {}, cookie);
    return json?.data ? json : { ...json, data: json };
  }

  if (path === '/logout') {
    const { json } = await neteaseWeapiRequest('/logout', {}, cookie);
    return json;
  }

  if (path === '/user/playlist') {
    const uid = Number(params.get('uid') || 0);
    const limit = clampInteger(params.get('limit'), 1, 1000, 100);
    const offset = clampInteger(params.get('offset'), 0, 100000, 0);
    const { json } = await neteaseWeapiRequest('/user/playlist', {
      uid,
      limit,
      offset,
      includeVideo: true
    }, cookie);
    return json;
  }

  if (path === '/likelist') {
    const uid = Number(params.get('uid') || 0);
    const { json } = await neteaseWeapiRequest('/song/like/get', { uid }, cookie);
    return json;
  }

  if (path === '/song/detail') {
    const ids = parseIdList(params.get('ids') || params.get('id'));
    return fetchNeteaseSongDetails(ids, cookie);
  }

  if (path === '/playlist/track/all') {
    const id = Number(params.get('id') || 0);
    const limit = clampInteger(params.get('limit'), 1, 1000, 500);
    const offset = clampInteger(params.get('offset'), 0, 100000, 0);
    const { json } = await neteaseWeapiRequest('/v6/playlist/detail', {
      id,
      n: limit,
      s: 8,
      offset,
      total: true
    }, cookie);
    const tracks = Array.isArray(json?.playlist?.tracks) ? json.playlist.tracks : [];
    if (tracks.length) return { code: json.code || 200, songs: tracks.slice(0, limit) };
    const ids = (json?.playlist?.trackIds || []).slice(offset, offset + limit).map(item => item.id).filter(Boolean);
    return fetchNeteaseSongDetails(ids, cookie);
  }

  if (path === '/lyric') {
    const target = new URL(`${NETEASE_WEB_ORIGIN}/api/song/lyric`);
    target.searchParams.set('id', String(params.get('id') || ''));
    target.searchParams.set('lv', '-1');
    target.searchParams.set('kv', '-1');
    target.searchParams.set('tv', '-1');
    return fetchNeteasePlainJson(target, cookie);
  }

  if (path === '/song/url' || path === '/song/url/v1') {
    const id = Number(params.get('id') || 0);
    const br = path === '/song/url/v1' ? levelToBitrate(params.get('level')) : clampInteger(params.get('br'), 64000, 999000, 320000);
    const { json } = await neteaseWeapiRequest('/song/enhance/player/url', {
      ids: JSON.stringify([id]),
      br
    }, cookie);
    return json;
  }

  return { code: 404, message: 'not found' };
}

async function fetchNeteaseSongDetails(ids, cookie) {
  const cleanIds = parseIdList(ids);
  if (!cleanIds.length) return { code: 400, songs: [] };
  const songs = [];
  for (let i = 0; i < cleanIds.length; i += 200) {
    const chunk = cleanIds.slice(i, i + 200);
    const { json } = await neteaseWeapiRequest('/v3/song/detail', {
      c: JSON.stringify(chunk.map(id => ({ id }))),
      ids: JSON.stringify(chunk)
    }, cookie);
    if (Array.isArray(json?.songs)) songs.push(...json.songs);
  }
  return { code: 200, songs };
}

async function neteasePlainApiRequest(path, data, cookie) {
  const response = await fetch(`${NETEASE_API_ORIGIN}${path}`, {
    method: 'POST',
    headers: createNeteaseApiHeaders(cookie, 'application/x-www-form-urlencoded'),
    body: new URLSearchParams(Object.entries(data).map(([key, value]) => [key, String(value)])).toString(),
    redirect: 'follow'
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    json = { code: response.status, message: text || response.statusText };
  }
  if (!response.ok && !json.code) json.code = response.status;
  return { json, cookie: collectSetCookie(response.headers) };
}

async function neteaseWeapiRequest(path, data, cookie) {
  const csrf = getNeteaseCsrf(cookie);
  const payload = { ...data, csrf_token: csrf };
  const encrypted = await createWeapiPayload(payload);
  const response = await fetch(`${NETEASE_WEB_ORIGIN}/weapi${path}?csrf_token=${encodeURIComponent(csrf)}`, {
    method: 'POST',
    headers: createNeteaseHeaders(cookie, 'application/x-www-form-urlencoded'),
    body: new URLSearchParams(encrypted).toString(),
    redirect: 'follow'
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch (e) {
    json = { code: response.status, message: text || response.statusText };
  }
  if (!response.ok && !json.code) json.code = response.status;
  return { json, cookie: collectSetCookie(response.headers) };
}

async function fetchNeteasePlainJson(target, cookie) {
  const response = await fetch(target.toString(), {
    headers: createNeteaseHeaders(cookie),
    redirect: 'follow'
  });
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch (e) {
    return { code: response.status, message: text || response.statusText };
  }
}

function createNeteaseHeaders(cookie, contentType = '') {
  const headers = {
    Referer: `${NETEASE_WEB_ORIGIN}/`,
    Origin: NETEASE_WEB_ORIGIN,
    'User-Agent': NETEASE_USER_AGENT,
    Accept: 'application/json,text/plain,*/*'
  };
  if (contentType) headers['Content-Type'] = contentType;
  const sessionCookie = createNeteaseClientCookie(cookie);
  if (sessionCookie) headers.Cookie = sessionCookie;
  return headers;
}

function createNeteaseApiHeaders(cookie, contentType = '') {
  const headers = {
    Referer: `${NETEASE_WEB_ORIGIN}/`,
    Origin: NETEASE_WEB_ORIGIN,
    'User-Agent': NETEASE_API_USER_AGENT,
    Accept: 'application/json,text/plain,*/*'
  };
  if (contentType) headers['Content-Type'] = contentType;
  headers.Cookie = createNeteaseApiHeaderCookie(cookie);
  return headers;
}

function createNeteaseClientCookie(cookie) {
  const map = cookieStringToObject(cookie);
  const nuid = map._ntes_nuid || createRandomHex(64);
  const deviceId = map.deviceId || map.sDeviceId || createRandomHex(52).toUpperCase();
  return cookieObjectToString({
    ...map,
    __remember_me: map.__remember_me || 'true',
    ntes_kaola_ad: map.ntes_kaola_ad || '1',
    _ntes_nuid: nuid,
    _ntes_nnid: map._ntes_nnid || `${nuid},${Date.now()}`,
    WNMCID: map.WNMCID || `${createRandomLetters(6)}.${Date.now()}.01.0`,
    WEVNSM: map.WEVNSM || '1.0.0',
    osver: map.osver || NETEASE_PC_COOKIE.osver,
    deviceId,
    sDeviceId: map.sDeviceId || deviceId,
    os: map.os || NETEASE_PC_COOKIE.os,
    channel: map.channel || NETEASE_PC_COOKIE.channel,
    appver: map.appver || NETEASE_PC_COOKIE.appver
  });
}

function createNeteaseApiHeaderCookie(cookie) {
  const map = cookieStringToObject(createNeteaseClientCookie(cookie));
  const header = {
    osver: map.osver || NETEASE_PC_COOKIE.osver,
    deviceId: map.deviceId || map.sDeviceId || createRandomHex(52).toUpperCase(),
    os: map.os || NETEASE_PC_COOKIE.os,
    appver: map.appver || NETEASE_PC_COOKIE.appver,
    versioncode: map.versioncode || '140',
    mobilename: map.mobilename || '',
    buildver: map.buildver || String(Date.now()).slice(0, 10),
    resolution: map.resolution || '1920x1080',
    __csrf: map.__csrf || '',
    channel: map.channel || NETEASE_PC_COOKIE.channel,
    requestId: createNeteaseRequestId()
  };
  if (map.MUSIC_U) header.MUSIC_U = map.MUSIC_U;
  if (map.MUSIC_A) header.MUSIC_A = map.MUSIC_A;
  return cookieObjectToString(header, true);
}

function createNeteaseChainId(cookie) {
  const map = cookieStringToObject(createNeteaseClientCookie(cookie));
  const deviceId = map.sDeviceId || map.deviceId || `unknown-${Math.floor(Math.random() * 1000000)}`;
  return `v1_${deviceId}_web_login_${Date.now()}`;
}

function createNeteaseRequestId() {
  return `${Date.now()}_${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`;
}

function cookieStringToObject(cookie) {
  const map = {};
  String(cookie || '').split(';').forEach(part => {
    const text = part.trim();
    const eq = text.indexOf('=');
    if (eq <= 0) return;
    const key = text.slice(0, eq).trim();
    const value = text.slice(eq + 1).trim();
    if (key) map[key] = value;
  });
  return map;
}

function cookieObjectToString(map, encode = false) {
  return Object.entries(map)
    .filter(([key, value]) => key && value != null && value !== '')
    .map(([key, value]) => {
      const cleanKey = encode ? encodeURIComponent(key) : key;
      const cleanValue = encode ? encodeURIComponent(String(value)) : String(value);
      return `${cleanKey}=${cleanValue}`;
    })
    .join('; ');
}

function createRandomHex(size) {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(size / 2)));
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, size);
}

function createRandomLetters(size) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes).map(byte => chars[byte % chars.length]).join('');
}

async function createWeapiPayload(data) {
  const secretKey = createSecretKey(16);
  const first = await aesCbcEncryptBase64(JSON.stringify(data), WEAPI_PRESET_KEY);
  const params = await aesCbcEncryptBase64(first, secretKey);
  return {
    params,
    encSecKey: rsaEncrypt(secretKey)
  };
}

async function aesCbcEncryptBase64(text, keyText) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(keyText), { name: 'AES-CBC' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: encoder.encode(WEAPI_IV) }, key, encoder.encode(text));
  return bytesToBase64(new Uint8Array(encrypted));
}

function rsaEncrypt(text) {
  const reversed = text.split('').reverse().join('');
  const hex = Array.from(new TextEncoder().encode(reversed)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const value = BigInt(`0x${hex}`);
  const encrypted = modPow(value, BigInt(`0x${WEAPI_PUBLIC_KEY}`), BigInt(`0x${WEAPI_MODULUS}`));
  return encrypted.toString(16).padStart(256, '0');
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  let value = base % modulus;
  let exp = exponent;
  while (exp > 0n) {
    if (exp & 1n) result = (result * value) % modulus;
    value = (value * value) % modulus;
    exp >>= 1n;
  }
  return result;
}

function createSecretKey(size) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes).map(byte => chars[byte % chars.length]).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function collectSetCookie(headers) {
  const list = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  const rawList = list.length ? list : String(headers.get('set-cookie') || '').split(/,(?=[^;,]+=)/);
  return rawList
    .map(item => String(item || '').split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function storeNeteaseQrCookie(key, cookie) {
  if (!key || !cookie || typeof caches === 'undefined') return;
  try {
    const request = new Request(`https://bynd.internal/netease-qr-cookie/${encodeURIComponent(key)}`);
    const response = new Response(cookie, {
      headers: { 'Cache-Control': 'public, max-age=300' }
    });
    await caches.default.put(request, response);
  } catch (e) {}
}

async function getNeteaseQrCookie(key) {
  if (!key || typeof caches === 'undefined') return '';
  try {
    const request = new Request(`https://bynd.internal/netease-qr-cookie/${encodeURIComponent(key)}`);
    const response = await caches.default.match(request);
    return response ? normalizeCookie(await response.text()) : '';
  } catch (e) {
    return '';
  }
}

function mergeCookieStrings(...cookies) {
  const map = new Map();
  cookies.forEach(cookie => {
    String(cookie || '').split(';').forEach(part => {
      const text = part.trim();
      const eq = text.indexOf('=');
      if (eq <= 0) return;
      map.set(text.slice(0, eq), text.slice(eq + 1));
    });
  });
  return Array.from(map.entries()).map(([key, value]) => `${key}=${value}`).join('; ');
}

function getNeteaseCsrf(cookie) {
  const match = String(cookie || '').match(/(?:^|;\s*)__csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function parseIdList(value) {
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  return String(value || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map(item => Number(String(item).replace(/[^\d]/g, '')))
    .filter(Boolean);
}

function clampInteger(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function levelToBitrate(level) {
  const key = String(level || '').toLowerCase();
  if (key === 'standard') return 128000;
  if (key === 'higher') return 192000;
  return 320000;
}

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
  const headers = corsHeaders();
  if (data == null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Range',
    'Access-Control-Expose-Headers': 'Content-Length,Content-Range,Accept-Ranges'
  };
}
