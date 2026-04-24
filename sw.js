// 自动记账 PWA Service Worker
// 策略：HTML 文件每次加载都从网络获取（确保用户看到最新版本）
// 静态资源（图标等）使用缓存

const CACHE_VERSION = 'v5';
const CACHE_NAME = 'accounting-app-' + CACHE_VERSION;

// 只缓存静态资源，不缓存 HTML 主文件
const STATIC_ASSETS = [
];

// 安装：不预缓存任何文件
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 激活：清理所有旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('accounting-app-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] 删除旧缓存:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // 清除所有浏览器缓存的 HTML 文件
      return clients.claim();
    })
  );
});

// 拦截请求：HTML 走网络，静态资源走缓存
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // HTML 文件和 API 请求：Network First，不使用缓存
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/') || url.pathname.includes('api')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // JS/CSS/图片等静态资源：Cache First
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    self.registration.update();
  }
  // 强制清除所有缓存并重新加载
  if (event.data && event.data.type === 'CLEAR_ALL_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
    clients.matchAll().then((cs) => {
      cs.forEach((client) => client.navigate(client.url));
    });
  }
});
