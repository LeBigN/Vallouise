/* Vallouise — service worker
   Bump CACHE à chaque déploiement pour forcer la mise à jour des PWA installées. */
const CACHE = "vallouise-v42";
const COQUILLE = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];
/* mairie.json est volontairement hors coquille : toujours réseau d'abord,
   pour ne jamais afficher un vieil arrêté comme s'il était en cours. */

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // Firestore / Auth : toujours le réseau (le cache hors ligne est géré par Firestore lui-même)
  if (/firestore|identitytoolkit|googleapis\.com\/google\.firestore/.test(url.href)) return;

  // Modules Firebase + polices : cache d'abord, puis réseau
  if (/gstatic\.com|googleapis\.com|cdnjs\.cloudflare\.com/.test(url.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r ||
      fetch(e.request).then(res => {
        const copie = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copie));
        return res;
      })));
    return;
  }

  // index.html : TOUJOURS le réseau en premier, jamais servi depuis le cache
  // tant qu'une réponse fraîche est disponible — sinon une correction déposée
  // sur GitHub peut rester invisible pendant des heures.
  if (url.pathname.endsWith("/") || url.pathname.endsWith("index.html")) {
    e.respondWith(
      fetch(e.request, {cache: "no-store"}).then(res => {
        const copie = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copie));
        return res;
      }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Autres fichiers de l'app : réseau d'abord, cache en secours
  e.respondWith(
    fetch(e.request).then(res => {
      const copie = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copie));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
