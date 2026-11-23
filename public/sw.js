/* Word Atlas offline cache: app shell / grammar / lexdb network-first, static media cache-first, plus Range 206 support for cached media. */
// v6: adds precache-manifest.json precaching so React.lazy route JS/CSS chunks work offline without hitting ErrorBoundary.
const VERSION = "atlas-v6";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;
const LEXDB = `${VERSION}-lexdb`;
const OFFLINE_MEDIA = "atlas-offline-media";

function extractShellUrls(html, scope) {
  const urls = new Set();
  const base = new URL("./", scope);
  urls.add(base.href);
  urls.add(new URL("index.html", base).href);
  urls.add(new URL("manifest.webmanifest", base).href);
  urls.add(new URL("favicon.svg", base).href);
  urls.add(new URL("atlas/index.json", base).href);

  const attrRe = /(?:src|href)=["']([^"'#]+)["']/gi;
  let match;
  while ((match = attrRe.exec(html)) !== null) {
    const raw = match[1];
    if (!raw || /^(?:data:|blob:|mailto:|javascript:)/i.test(raw)) continue;
    try {
      const resolved = new URL(raw, base);
      if (resolved.origin !== self.location.origin) continue;
      if (resolved.pathname.includes("/materials/")) continue;
      if (/\.(?:js|css|svg|webmanifest)(?:\?|$)/i.test(resolved.pathname) || resolved.pathname.endsWith("/atlas/index.json")) {
        urls.add(resolved.href);
      }
    } catch {
      /* ignore malformed attribute url */
    }
  }
  return [...urls];
}

function parseByteRange(rangeHeader, total) {
  if (!rangeHeader || !Number.isFinite(total) || total < 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m || (!m[1] && !m[2])) return null;
  let start;
  let end;
  if (!m[1]) {
    const suffix = Number(m[2]);
    if (!Number.isFinite(suffix) || suffix <= 0 || total === 0) return { invalid: true };
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= total || start > end) {
      return { invalid: true };
    }
  }
  return { invalid: false, start, end };
}

async function buildPartialResponse(cachedRes, rangeHeader) {
  const blob = await cachedRes.blob();
  const total = blob.size;
  const contentType = cachedRes.headers.get("content-type") || blob.type || "audio/mpeg";
  const parsed = parseByteRange(rangeHeader, total);
  if (!parsed) {
    const headers = new Headers(cachedRes.headers);
    headers.delete("content-encoding");
    headers.set("Accept-Ranges", "bytes");
    headers.set("Content-Length", String(total));
    headers.set("Content-Type", contentType);
    return new Response(blob, { status: 200, statusText: "OK", headers });
  }
  if (parsed.invalid) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: {
        "Content-Range": `bytes */${total}`,
        "Accept-Ranges": "bytes",
      },
    });
  }
  const { start, end } = parsed;
  const slice = blob.slice(start, end + 1, contentType);
  const headers = new Headers(cachedRes.headers);
  headers.delete("content-encoding");
  headers.set("Content-Type", contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(slice.size));
  return new Response(slice, {
    status: 206,
    statusText: "Partial Content",
    headers,
  });
}

async function matchOfflineMedia(url) {
  const offline = await caches.open(OFFLINE_MEDIA);
  const hit = await offline.match(url, { ignoreVary: true });
  if (hit) return hit;
  const media = await caches.open(MEDIA);
  return media.match(url, { ignoreVary: true });
}

self.addEventListener("install", (event) => {
  const task = (async () => {
    const scope = (self.registration && self.registration.scope) || self.location.href;
    const base = new URL("./", scope);
    const rootUrl = base.href;
    const indexUrl = new URL("index.html", base).href;
    const manifestUrl = new URL("precache-manifest.json", base).href;
    const cache = await caches.open(SHELL);
    let html = "";
    try {
      const res = await fetch(rootUrl, { cache: "no-cache" });
      if (res.ok) {
        const copy1 = res.clone();
        const copy2 = res.clone();
        html = await res.text();
        await cache.put(rootUrl, copy1);
        await cache.put(indexUrl, copy2);
      }
    } catch {
      /* offline during install */
    }
    const urlSet = new Set(extractShellUrls(html, scope));
    try {
      const mRes = await fetch(manifestUrl, { cache: "no-cache" });
      if (mRes.ok) {
        const data = await mRes.json();
        const assets = data && Array.isArray(data.assets) ? data.assets : [];
        for (const rel of assets) {
          if (typeof rel !== "string" || !rel || rel.includes("/materials/")) continue;
          try {
            const resolved = new URL(rel.replace(/^\//, ""), base);
            if (resolved.origin === self.location.origin) urlSet.add(resolved.href);
          } catch {
            /* ignore malformed asset path */
          }
        }
      }
    } catch {
      /* no precache-manifest in dev or offline */
    }
    const urls = [...urlSet].filter((u) => u !== rootUrl && u !== indexUrl);
    for (let i = 0; i < urls.length; i += 12) {
      await Promise.allSettled(
        urls.slice(i, i + 12).map(async (u) => {
          const r = await fetch(u, { cache: "no-cache" });
          if (r.ok) await cache.put(u, r);
        }),
      );
    }
  })()
    .catch(() => {})
    .then(() => self.skipWaiting());
  if (event && typeof event.waitUntil === "function") event.waitUntil(task);
  else void task;
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION) && k !== OFFLINE_MEDIA).map((k) => caches.delete(k))))
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
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isBlobMedia =
    url.origin !== self.location.origin &&
    /\.blob\.core\.windows\.net$/i.test(url.hostname) &&
    (url.pathname.includes("/materials/") || url.pathname.includes("/atlas/audio/"));
  if (url.origin !== self.location.origin && !isBlobMedia) return;
  // a request that asks for the server's current copy (the new-version check) or hits local proxies is not answered from a cache
  if (req.cache === "no-store") return;
  if (url.pathname.includes("/dictionary-proxy") || url.pathname.includes("/ai-proxy")) return;

  if (req.headers.has("range")) {
    event.respondWith(
      (async () => {
        const hit = await matchOfflineMedia(req.url);
        if (hit) return buildPartialResponse(hit, req.headers.get("range"));
        return fetch(req);
      })(),
    );
    return;
  }

  if (url.pathname.includes("/materials/") && /\.(?:mp3|m4a|aac|ogg|oga|wav|mp4|webm|m4v|json|vtt)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const hit = await matchOfflineMedia(req.url);
        if (hit) return hit;
        return fetch(req);
      })(),
    );
    return;
  }

  const isShell =
    req.mode === "navigate" ||
    url.pathname.endsWith("/index.json") ||
    url.pathname.includes("/atlas/entries/") ||
    url.pathname.endsWith("/atlas/grammar.json") ||
    url.pathname.endsWith("/atlas/conj.json") ||
    url.pathname.endsWith("/atlas/confusables.json");

  if (isShell) {
    event.respondWith(
      (req.mode === "navigate" ? fetch(req.url, { cache: "no-cache" }) : fetch(req))
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            const putTask = caches
              .open(SHELL)
              .then((c) => c.put(req, copy))
              .catch(() => {});
            if (typeof event.waitUntil === "function") event.waitUntil(putTask);
          }
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(req, { ignoreVary: true });
          if (hit) return hit;
          if (req.mode === "navigate") {
            const scope = (self.registration && self.registration.scope) || self.location.href;
            return (
              (await caches.match(new URL("./", scope).href, { ignoreVary: true })) ||
              (await caches.match(new URL("index.html", scope).href, { ignoreVary: true })) ||
              new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
            );
          }
          return Response.error();
        }),
    );
    return;
  }

  if (url.pathname.includes("/lexdb/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && (res.type === "basic" || res.type === "default")) {
            const copy = res.clone();
            const putTask = caches
              .open(LEXDB)
              .then((c) => c.put(req, copy))
              .then(() => trim(LEXDB, 400))
              .catch(() => {});
            if (typeof event.waitUntil === "function") event.waitUntil(putTask);
          }
          return res;
        })
        .catch(async () => {
          const c = await caches.open(LEXDB);
          const hit = await c.match(req, { ignoreVary: true });
          return hit || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (res.type === "basic" || res.type === "default" || (isBlobMedia && res.type === "cors"))) {
            const copy = res.clone();
            const name = /\/atlas\/(img|thumb|audio)\//.test(url.pathname) ? MEDIA : SHELL;
            const putTask = caches
              .open(name)
              .then((c) => c.put(req, copy))
              .then(() => name === MEDIA && trim(MEDIA, 1500))
              .catch(() => {});
            if (typeof event.waitUntil === "function") event.waitUntil(putTask);
          }
          return res;
        }),
    ),
  );
});
