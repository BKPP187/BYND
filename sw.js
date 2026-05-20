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

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    const payload = parsePushPayload(event);
    const config = await readNotifyConfig();
    const char = Array.isArray(config.chars) && config.chars.length ? config.chars[0] : {};
    const title = payload.title || (char.name ? `${char.name} 想找你` : 'BYND');
    const options = {
      body: payload.body || '你有一段时间没有主动联系了。',
      icon: payload.icon || payload.avatar || char.avatar || undefined,
      badge: payload.badge || payload.icon || char.avatar || undefined,
      tag: payload.tag || (char.id ? `bynd-proactive-${char.id}` : 'bynd-proactive'),
      data: payload.data || { url: payload.url || config.url || '/?open=wechat' },
      renotify: !!payload.renotify
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/?open=wechat';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(url);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});

const BYND_NOTIFY_CACHE = 'bynd-notify-cache-v1';
const BYND_NOTIFY_CONFIG_URL = '/__bynd_notify_config__';

async function saveNotifyConfig(config) {
  const cache = await caches.open(BYND_NOTIFY_CACHE);
  await cache.put(BYND_NOTIFY_CONFIG_URL, new Response(JSON.stringify(config || {}), {
    headers: { 'Content-Type': 'application/json' }
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
