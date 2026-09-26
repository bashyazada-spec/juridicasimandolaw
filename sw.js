// ═══════════════════════════════════════════════════════════════
//  SIMANDO LAW — PROGRESSIVE WEB APP (PWA) SERVICE WORKER
//  Enables "Install as Web App", Offline Fallback & Fast Cache
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = "simando-law-pwa-v1.0";
const PRECACHE_ASSETS = [
  "./",
  "./mobile.html",
  "./tablet.html",
  "./index.html",
  "./css/mobile.css",
  "./css/desktop.css",
  "./js/redirect.js",
  "./js/config.js",
  "./js/data.js",
  "./js/drive.js",
  "./js/ui.js",
  "./js/app.js",
  "./js/chat.js",
  "./manifest.json"
];

// 1. Install & Pre-cache Essential App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[PWA ServiceWorker] Caching app shell assets...");
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[PWA ServiceWorker] Non-critical precache warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate & Purge Stale Caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[PWA ServiceWorker] Purging obsolete cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Network-First Strategy (Real-time data integrity with offline cache backup)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass Google APIs, Firestore WebChannel & Auth requests from service worker caching
  if (
    url.origin.includes("googleapis.com") ||
    url.origin.includes("gstatic.com") ||
    url.origin.includes("firebaseio.com") ||
    url.origin.includes("cloudfunctions.net") ||
    req.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        // Cache successful local page and asset responses
        if (networkRes && networkRes.status === 200 && networkRes.type === "basic") {
          const resClone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkRes;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(req).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          if (req.mode === "navigate") {
            return caches.match("./mobile.html");
          }
        });
      })
  );
});