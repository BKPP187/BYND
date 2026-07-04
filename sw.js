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
const BYND_NOTIFY_ICON = '/bynd-icon.svg';

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
