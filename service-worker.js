const CACHE_NAME = '2048-cupcakes-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/game.js',
  '/favicon.svg',
  '/manifest.json', // 可以考虑缓存 manifest
  // '/img/2-vanilla-cupcake.webp', // 初始可以不缓存所有图片，按需添加或使用更高级的缓存策略
  // ... 其他重要的图片或字体文件也可以在这里列出
  '/img/2-vanilla-cupcake.webp',
  '/img/4-strawberry-vanilla-cupcake.webp',
  '/img/8-lemon-cupcake.webp',
  '/img/16-red-velvet-cupcake.webp',
  '/img/32-mint-cupcake.webp',
  '/img/64-jumbo-oreo-cupcake.webp',
  '/img/128-birthday-cupcake.webp',
  '/img/256-royal-blue-cupcake.webp',
  '/img/512-caramel-cupcake.webp',
  '/img/1024-pink-champagne-cupcake.webp',
  '/img/2048-christmas-cupcake.webp',
  '/img/4096–galaxy-cupcake.webp',
  '/img/8192–unicorn-cupcake.webp',
  '/img/16384–gold-flake-cupcake.webp',
  '/img/32768–diamond-frost-cupcake.webp',
  '/img/65536–royal-crown-cupcake.webp',
  '/img/131072–ultimate-rainbow-delight-cupcake.webp',
  '/img/icons/icon-192x192.png',
  '/img/icons/icon-512x512.png'
];

// 安装 Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 激活 Service Worker，通常用于清理旧缓存
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 拦截网络请求
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果缓存中有匹配的响应，则返回缓存的响应
        if (response) {
          return response;
        }
        // 否则，正常发起网络请求
        return fetch(event.request);
      }
    )
  );
}); 