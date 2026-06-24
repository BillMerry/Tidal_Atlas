const CACHE_NAME = "north-brittany-tidal-atlas-v4";

const APP_SHELL = [
  "./",
  "index.html",
  "styles.css?v=4",
  "app.js?v=4",
  "tideProvider.js",
  "manifest.json",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "charts/1%20Cherbourg%20-5%20Brest-1.png",
  "charts/2%20Cherbourg%20-4%20Brest-H-W.png",
  "charts/3%20Cherbourg%20-3%20Brest-%2B-1.png",
  "charts/4%20Cherbourg%20-2%20Brest-%2B-2.png",
  "charts/5%20Cherbourg%20-1%20Brest-%2B-3.png",
  "charts/6%20Cherbourg%20-%200%20HW%20Brest-%2B-4.png",
  "charts/7%20Cherbourg%20%2B1%20Brest-%2B-5.png",
  "charts/8%20Cherbourg%20%2B2%20Brest-%2B-6.png",
  "charts/9%20Cherbourg%20%2B3%20Brest-5.png",
  "charts/10%20Cherbourg%20%2B4%20Brest-4.png",
  "charts/11%20Cherbourg%20%2B5%20Brest-3.png",
  "charts/12%20Cherbourg%20%2B6%20Brest-2.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === "opaque") {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
