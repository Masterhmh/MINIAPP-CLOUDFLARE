// ============================================================================
// sw.js — SERVICE WORKER (PWA / OFFLINE)
// ----------------------------------------------------------------------------
// Chiến lược: chỉ cache "khung" ứng dụng (HTML/CSS/JS tĩnh cùng origin) theo
//   kiểu NETWORK-FIRST — luôn ưu tiên bản mới từ mạng, chỉ dùng cache khi
//   mất kết nối. TUYỆT ĐỐI không cache dữ liệu Firebase / Google Sheet
//   (tài chính động) để tránh hiển thị số liệu cũ.
// ============================================================================
const CACHE_VERSION = 'miniapp-hmh-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './upgrade.css',
  './app-core.js',
  './currency.js',
  './app-reports.js',
  './app-crud.js',
  './app-export.js',
  './app-init.js',
  './app-upgrade.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // bỏ qua POST/PUT/DELETE (ghi dữ liệu)

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Chỉ xử lý tài nguyên tĩnh cùng origin. Firebase/GAS/CDN -> để trình duyệt gọi mạng bình thường.
  if (!sameOrigin) return;

  // Không đụng vào Cloudflare Pages Functions (/api/...) hay endpoint động.
  if (url.pathname.startsWith('/api/')) return;

  // NETWORK-FIRST: lấy bản mới, lưu lại cache; offline thì dùng cache, cuối cùng fallback index.html.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
  );
});
