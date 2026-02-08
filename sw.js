const CACHE = "jimpitan-v1";

const FILES = [
  "/bankflow-jimpitan/",
  "/bankflow-jimpitan/index.html",
  "/bankflow-jimpitan/manifest.json",
  "/bankflow-jimpitan/icon-192.png",
  "/bankflow-jimpitan/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  e.respondWith(
    caches.match(e.request).then(res => {
      return res || fetch(e.request).then(net => {
        return caches.open(CACHE).then(cache => {
          cache.put(e.request, net.clone());
          return net;
        });
      });
    })
  );
});
