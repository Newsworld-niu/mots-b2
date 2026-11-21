import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";

type Listener = (event: any) => void;

function makeMemCache() {
  const map = new Map<string, Response>();
  const keyOf = (req: RequestInfo | URL) => (typeof req === "string" ? req : req instanceof URL ? req.href : req.url);
  return {
    map,
    async put(req: RequestInfo | URL, res: Response) {
      map.set(keyOf(req), res);
    },
    async match(req: RequestInfo | URL) {
      const hit = map.get(keyOf(req));
      return hit ? hit.clone() : undefined;
    },
    async delete(req: RequestInfo | URL) {
      return map.delete(keyOf(req));
    },
    async keys() {
      return [...map.keys()].map((u) => new Request(u));
    },
  };
}

function loadSw(opts?: { fetchImpl?: typeof fetch; initialCaches?: Record<string, ReturnType<typeof makeMemCache>> }) {
  const listeners = new Map<string, Listener[]>();
  const stores = new Map<string, ReturnType<typeof makeMemCache>>(Object.entries(opts?.initialCaches ?? {}));
  let skipWaitingCalled = false;
  let claimCalled = false;

  const cachesMock = {
    async open(name: string) {
      let c = stores.get(name);
      if (!c) {
        c = makeMemCache();
        stores.set(name, c);
      }
      return c;
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async match(req: RequestInfo | URL) {
      for (const c of stores.values()) {
        const hit = await c.match(req);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const selfMock: any = {
    location: new URL("https://app.test/"),
    registration: { scope: "https://app.test/" },
    skipWaiting() {
      skipWaitingCalled = true;
      return Promise.resolve();
    },
    clients: {
      claim() {
        claimCalled = true;
        return Promise.resolve();
      },
    },
    addEventListener(type: string, fn: Listener) {
      const list = listeners.get(type) ?? [];
      list.push(fn);
      listeners.set(type, list);
    },
  };

  const swSource = readFileSync(path.resolve(process.cwd(), "public/sw.js"), "utf8");
  const context = vm.createContext({
    self: selfMock,
    caches: cachesMock,
    fetch: opts?.fetchImpl ?? (() => Promise.reject(new Error("offline"))),
    URL,
    Request,
    Response,
    Headers,
    Blob,
    Promise,
    Number,
    Set,
  });
  vm.runInContext(swSource, context, { filename: "public/sw.js" });

  async function dispatchLifecycle(type: "install" | "activate") {
    const waits: Promise<unknown>[] = [];
    for (const fn of listeners.get(type) ?? []) {
      fn({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    }
    await Promise.all(waits);
  }

  async function dispatchFetch(req: Request): Promise<{ intercepted: boolean; response?: Response; waitTasks: Promise<unknown>[] }> {
    let responsePromise: Promise<Response> | null = null;
    const waitTasks: Promise<unknown>[] = [];
    const ev = {
      request: req,
      respondWith(p: Promise<Response> | Response) {
        responsePromise = Promise.resolve(p);
      },
      waitUntil(p: Promise<unknown>) {
        waitTasks.push(p);
      },
    };
    for (const fn of listeners.get("fetch") ?? []) fn(ev);
    if (!responsePromise) return { intercepted: false, waitTasks };
    const response = await (responsePromise as Promise<Response>);
    return { intercepted: true, response, waitTasks };
  }

  return {
    stores,
    cachesMock,
    dispatchLifecycle,
    dispatchFetch,
    wasSkipWaitingCalled: () => skipWaitingCalled,
    wasClaimCalled: () => claimCalled,
  };
}

test("sw install precaches basic app shell without 28MB materials and activate cleans old caches while keeping offline media", async () => {
  const html = `<!doctype html><html><head>
    <link rel="icon" href="/favicon.svg">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="preload" href="/atlas/index.json" as="fetch">
    <script type="module" src="/assets/index-abc123.js"></script>
    <link rel="stylesheet" href="/assets/index-def456.css">
  </head><body><div id="root"></div></body></html>`;
  const fetched: string[] = [];
  const sw = loadSw({
    initialCaches: {
      "atlas-v2-shell": makeMemCache(),
      "atlas-v2-media": makeMemCache(),
      "atlas-offline-media": makeMemCache(),
    },
    fetchImpl: async (input) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      fetched.push(u);
      if (u === "https://app.test/") return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
      if (u.endsWith(".js")) return new Response("console.log(1)", { status: 200, headers: { "Content-Type": "application/javascript" } });
      if (u.endsWith(".css")) return new Response("body{}", { status: 200, headers: { "Content-Type": "text/css" } });
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  await sw.dispatchLifecycle("install");
  assert.equal(sw.wasSkipWaitingCalled(), true);
  assert.ok(fetched.every((u) => !u.includes("/materials/")));

  const shell = sw.stores.get("atlas-v3-shell")!;
  assert.ok(shell.map.has("https://app.test/"));
  assert.ok(shell.map.has("https://app.test/index.html"));
  assert.ok(shell.map.has("https://app.test/assets/index-abc123.js"));
  assert.ok(shell.map.has("https://app.test/assets/index-def456.css"));
  assert.ok(shell.map.has("https://app.test/atlas/index.json"));

  await sw.dispatchLifecycle("activate");
  assert.equal(sw.wasClaimCalled(), true);
  assert.equal(sw.stores.has("atlas-v2-shell"), false);
  assert.equal(sw.stores.has("atlas-v2-media"), false);
  assert.equal(sw.stores.has("atlas-v3-shell"), true);
  assert.equal(sw.stores.has("atlas-offline-media"), true);
});

test("sw clones shell response synchronously before returning and survives cache write failure + offline navigate fallback", async () => {
  let online = true;
  const sw = loadSw({
    fetchImpl: async () => {
      if (!online) throw new Error("net::ERR_INTERNET_DISCONNECTED");
      return new Response("<html>shell</html>", { status: 200, headers: { "Content-Type": "text/html" } });
    },
  });

  // 1. Online navigate: consumer immediately reads response body, yet SW still caches synchronously cloned copy
  const makeNavReq = (u: string) => Object.defineProperty(new Request(u), "mode", { value: "navigate" }) as Request;
  const navReq = makeNavReq("https://app.test/");
  const r1 = await sw.dispatchFetch(navReq);
  assert.equal(r1.intercepted, true);
  assert.equal(await r1.response!.text(), "<html>shell</html>");
  await Promise.all(r1.waitTasks);

  const cachedShell = await sw.stores.get("atlas-v3-shell")!.match("https://app.test/");
  assert.ok(cachedShell);
  assert.equal(await cachedShell!.text(), "<html>shell</html>");

  // 2. Cache put throws -> does not throw unhandled error
  const origPut = sw.stores.get("atlas-v3-shell")!.put;
  sw.stores.get("atlas-v3-shell")!.put = async () => {
    throw new Error("QuotaExceededError");
  };
  const r2 = await sw.dispatchFetch(new Request("https://app.test/atlas/index.json"));
  assert.equal(r2.intercepted, true);
  assert.equal(r2.response!.status, 200);
  await Promise.all(r2.waitTasks);
  sw.stores.get("atlas-v3-shell")!.put = origPut;

  // 3. Offline navigate to root or another sub-path falls back cleanly to cached shell
  online = false;
  const offNav = makeNavReq("https://app.test/subroute");
  const r3 = await sw.dispatchFetch(offNav);
  assert.equal(r3.intercepted, true);
  assert.equal(r3.response!.status, 200);
  assert.equal(await r3.response!.text(), "<html>shell</html>");
});

test("sw synthesizes 206 Partial Content for cached RFI audio Range requests and passes through uncached Range requests", async () => {
  const audioBytes = new Uint8Array(26);
  for (let i = 0; i < 26; i++) audioBytes[i] = 65 + i; // "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  const offlineCache = makeMemCache();
  await offlineCache.put(
    "https://app.test/materials/rfi/rfi-jff-20261120.mp3",
    new Response(audioBytes, { status: 200, headers: { "Content-Type": "audio/mpeg", "Content-Length": "26" } }),
  );

  const networkRequests: Array<{ url: string; range: string | null }> = [];
  const sw = loadSw({
    initialCaches: { "atlas-offline-media": offlineCache },
    fetchImpl: async (input) => {
      const req = input as Request;
      networkRequests.push({ url: req.url, range: req.headers.get("range") });
      return new Response("net-range", { status: 206, headers: { "Content-Range": "bytes 0-8/9" } });
    },
  });

  // bytes=0-
  const openEnd = await sw.dispatchFetch(
    new Request("https://app.test/materials/rfi/rfi-jff-20261120.mp3", { headers: { Range: "bytes=0-" } }),
  );
  assert.equal(openEnd.response!.status, 206);
  assert.equal(openEnd.response!.headers.get("content-range"), "bytes 0-25/26");
  assert.equal(openEnd.response!.headers.get("content-length"), "26");
  assert.equal(openEnd.response!.headers.get("accept-ranges"), "bytes");
  assert.equal(openEnd.response!.headers.get("content-type"), "audio/mpeg");
  assert.equal(await openEnd.response!.text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ");

  // bytes=0-0 (single byte)
  const firstByte = await sw.dispatchFetch(
    new Request("https://app.test/materials/rfi/rfi-jff-20261120.mp3", { headers: { Range: "bytes=0-0" } }),
  );
  assert.equal(firstByte.response!.status, 206);
  assert.equal(firstByte.response!.headers.get("content-range"), "bytes 0-0/26");
  assert.equal(firstByte.response!.headers.get("content-length"), "1");
  assert.equal(await firstByte.response!.text(), "A");

  // bytes=5-9
  const mid = await sw.dispatchFetch(
    new Request("https://app.test/materials/rfi/rfi-jff-20261120.mp3", { headers: { Range: "bytes=5-9" } }),
  );
  assert.equal(mid.response!.status, 206);
  assert.equal(mid.response!.headers.get("content-range"), "bytes 5-9/26");
  assert.equal(mid.response!.headers.get("content-length"), "5");
  assert.equal(await mid.response!.text(), "FGHIJ");

  // bytes=20-999 (clamped end)
  const clamped = await sw.dispatchFetch(
    new Request("https://app.test/materials/rfi/rfi-jff-20261120.mp3", { headers: { Range: "bytes=20-999" } }),
  );
  assert.equal(clamped.response!.status, 206);
  assert.equal(clamped.response!.headers.get("content-range"), "bytes 20-25/26");
  assert.equal(await clamped.response!.text(), "UVWXYZ");

  // bytes=-4 (suffix)
  const suffix = await sw.dispatchFetch(
    new Request("https://app.test/materials/rfi/rfi-jff-20261120.mp3", { headers: { Range: "bytes=-4" } }),
  );
  assert.equal(suffix.response!.status, 206);
  assert.equal(suffix.response!.headers.get("content-range"), "bytes 22-25/26");
  assert.equal(await suffix.response!.text(), "WXYZ");

  // Invalid / out-of-bounds -> 416
  for (const bad of ["bytes=26-", "bytes=99-105", "bytes=10-5", "bytes=-0"]) {
    const oob = await sw.dispatchFetch(
      new Request("https://app.test/materials/rfi/rfi-jff-20261120.mp3", { headers: { Range: bad } }),
    );
    assert.equal(oob.response!.status, 416, `expected 416 for ${bad}`);
    assert.equal(oob.response!.headers.get("content-range"), "bytes */26");
  }

  // Multi-range -> 200 full fallback
  const multi = await sw.dispatchFetch(
    new Request("https://app.test/materials/rfi/rfi-jff-20261120.mp3", { headers: { Range: "bytes=0-1, 4-5" } }),
  );
  assert.equal(multi.response!.status, 200);
  assert.equal(await multi.response!.text(), "ABCDEFGHIJKLMNOPQRSTUVWXYZ");

  // Uncached audio Range request passes through to network with Range preserved
  const uncached = await sw.dispatchFetch(
    new Request("https://app.test/materials/rfi/rfi-jff-20261112.mp3", { headers: { Range: "bytes=0-100" } }),
  );
  assert.equal(uncached.response!.status, 206);
  assert.equal(networkRequests.length, 1);
  assert.equal(networkRequests[0].range, "bytes=0-100");
  assert.equal(sw.stores.get("atlas-v3-shell")?.map.has("https://app.test/materials/rfi/rfi-jff-20261112.mp3"), undefined);
});
