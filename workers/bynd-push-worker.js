const DEFAULT_INTERVAL_HOURS = 24;
const MIN_INTERVAL_HOURS = 0.1;
const MAX_INTERVAL_HOURS = 720;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return corsResponse(null, 204);

    try {
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
      return corsResponse({ ok: false, error: 'not found' }, 404);
    } catch (error) {
      return corsResponse({ ok: false, error: error.message || String(error) }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runProactiveTick(env));
  }
};

async function handleSubscribe(request, env) {
  const payload = await request.json();
  const clientId = normalizeClientId(payload.clientId);
  const record = normalizeRecord(payload);
  await putRecord(env, clientId, record);
  return { ok: true, clientId };
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
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
  if (payload === null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(payload), { status, headers });
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
