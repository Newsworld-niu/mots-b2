/* Word Atlas offline cache: app shell network-first, everything else cache-first. */
// dict/: the offline dictionary for adding words, network-first like the entry chunks.
// v2: entry chunks and conjugation tables are network-first, so a rebuilt learning path (new order) never mixes with stale chunks.
const VERSION = "atlas-v2";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // a request that asks for the server's current copy (the new-version check) is not answered from a cache
  if (req.cache === "no-store") return;
  const isShell = req.mode === "navigate" || url.pathname.endsWith("/index.json") || url.pathname.includes("/atlas/entries/") || url.pathname.endsWith("/atlas/conj.json") || url.pathname.endsWith("/atlas/confusables.json") || url.pathname.includes("/dict/");
  if (isShell) {
    event.respondWith(
      // the page itself always comes from the server (revalidated), so a new deployment shows on the next visit
      // instead of after the browser's own cache of index.html runs out
      (req.mode === "navigate" ? fetch(req.url, { cache: "no-cache" }) : fetch(req))
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(new URL("./", self.registration.scope).href))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            const name = /\/atlas\/(img|thumb|audio)\//.test(url.pathname) ? MEDIA : SHELL;
            caches.open(name).then((c) => c.put(req, copy)).then(() => name === MEDIA && trim(MEDIA, 1500));
          }
          return res;
        }),
    ),
  );
});
