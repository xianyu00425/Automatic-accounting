// 自动记账 PWA Service Worker
// 策略：Network First + Cache Fallback
// 自动更新：skipWaiting + clients.claim

const CACHE_VERSION = 'v4';
const CACHE_NAME = 'accounting-app-' + CACHE_VERSION;

// 需要缓存的核心文件
const CORE_ASSETS = [
  './',
  './自动记账.html',
  './manifest.json'
];

// 安装：预缓存核心文件
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] 预缓存核心文件');
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      // 跳过等待，立即激活
      return self.skipWaiting();
    })
  );
});

// 激活：清理旧缓存
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
      // 立即接管所有页面
      return self.clients.claim();
    })
  );
});

// 拦截请求：Network First + Cache Fallback
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求和同域请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // 优先尝试从网络获取
    fetch(event.request)
      .then((response) => {
        // 网络成功，更新缓存
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // 网络失败，使用缓存
        return caches.match(event.request);
      })
  );
});

// 监听页面消息，支持手动触发更新
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // 触发更新检查
    self.registration.update();
  }
});
