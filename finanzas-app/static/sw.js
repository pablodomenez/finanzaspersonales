const CACHE = "finanzas-v2";
const STATIC_ASSETS = [
  "/dashboard.html", "/transactions.html", "/budgets.html", "/goals.html",
  "/debts.html", "/cards.html", "/inversiones.html", "/reports.html",
  "/servicios.html", "/compartidos.html", "/alquileres.html",
  "/promociones.html", "/decisiones.html", "/profile.html",
  "/prestamos.html",
  "/js/api.js", "/js/theme.js", "/js/sidebar.js", "/js/common.js",
  "/js/prestamos.js",
  "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Solo manejar requests del mismo origen
  if (url.origin !== self.location.origin) return;
  // API calls: red siempre, nunca caché
  if (url.pathname.startsWith("/api/")) return;
  // Assets estáticos: caché primero, red como fallback
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
    )
  );
});
