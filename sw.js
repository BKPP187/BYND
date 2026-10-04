self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'BYND_NOTIFY_CONFIG') return;
  event.waitUntil(saveNotifyConfig(event.data.payload || {}));
});

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// No chat/API data is cached. A failed navigation gets an explicit retry screen.
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BYND · 离线</title><style>body{margin:0;min-height:100vh;display:grid;place-content:center;background:#f6f6f8;color:#292654;font:16px system-ui;padding:24px;box-sizing:border-box}button{padding:12px;border:0;border-radius:12px;background:#292654;color:white}</style><h1>暂时没有网络</h1><p>连接网络后重新打开 BYND。</p><button onclick="location.reload()">重新加载</button></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    try {
      const payload = parsePushPayload(event);
      const config = await readNotifyConfig();
      await showByndNotification(payload, config);
    } catch (error) {
      await showByndNotification({
        title: 'BYND',
        body: '有一条新的后台消息。'
      }, {});
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = resolveNotificationUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});

const BYND_NOTIFY_CACHE = 'bynd-notify-cache-v1';
const BYND_NOTIFY_CONFIG_URL = '/__bynd_notify_config__';
const BYND_NOTIFY_ICON = '/bynd-icon.png';

async function showByndNotification(payload, config) {
  const char = Array.isArray(config.chars) && config.chars.length ? config.chars[0] : {};
  const title = safeText(payload.title) || (safeText(char.name) ? `${safeText(char.name)} 想找你` : 'BYND');
  const body = safeText(payload.body) || '你有一段时间没有主动联系了。';
  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const options = {
    body,
    icon: BYND_NOTIFY_ICON,
    badge: BYND_NOTIFY_ICON,
    tag: safeText(payload.tag) || (char.id ? `bynd-proactive-${safeText(char.id)}` : 'bynd-proactive'),
    data: {
      ...data,
      url: resolveNotificationUrl(data.url || payload.url || config.url || '/?open=wechat')
    },
    renotify: !!payload.renotify
  };
  await self.registration.showNotification(title, options);
}

async function saveNotifyConfig(config) {
  const cache = await caches.open(BYND_NOTIFY_CACHE);
  await cache.put(BYND_NOTIFY_CONFIG_URL, new Response(JSON.stringify(config || {}), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  }));
}

async function readNotifyConfig() {
  try {
    const cache = await caches.open(BYND_NOTIFY_CACHE);
    const response = await cache.match(BYND_NOTIFY_CONFIG_URL);
    return response ? await response.json() : {};
  } catch (e) {
    return {};
  }
}

function parsePushPayload(event) {
  try {
    return event.data ? event.data.json() : {};
  } catch (e) {
    return { body: event.data ? event.data.text() : '' };
  }
}

function safeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

function resolveNotificationUrl(value) {
  try {
    const url = new URL(String(value || '/?open=wechat'), self.location.origin);
    if (url.origin !== self.location.origin) return '/?open=wechat';
    return url.pathname + url.search + url.hash;
  } catch (e) {
    return '/?open=wechat';
  }
}
