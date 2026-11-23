import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearAllOfflineMedia,
  downloadOfflinePack,
  formatBytes,
  getOfflinePacks,
  inspectOfflinePacks,
  OFFLINE_MEDIA_CACHE,
  removeOfflinePack,
  SW_MEDIA_CACHE,
  type OfflinePack,
} from "./offline-packs";

function makeMemCacheStorage() {
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (req: RequestInfo | URL) => (typeof req === "string" ? req : req instanceof URL ? req.href : req.url).split("#")[0];
  return {
    stores,
    async open(name: string) {
      let map = stores.get(name);
      if (!map) {
        map = new Map();
        stores.set(name, map);
      }
      return {
        async put(req: RequestInfo | URL, res: Response) {
          map!.set(keyOf(req), res);
        },
        async match(req: RequestInfo | URL) {
          const hit = map!.get(keyOf(req));
          return hit ? hit.clone() : undefined;
        },
        async delete(req: RequestInfo | URL) {
          return map!.delete(keyOf(req));
        },
        async keys() {
          return [...map!.keys()].map((u) => new Request(u));
        },
      } as unknown as Cache;
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async has(name: string) {
      return stores.has(name);
    },
    async keys() {
      return [...stores.keys()];
    },
    async match() {
      return undefined;
    },
  } as unknown as CacheStorage & { stores: Map<string, Map<string, Response>> };
}

test("formatBytes formats human-readable byte sizes", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(15 * 1024 * 1024), "15.0 MB");
  assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), "1.50 GB");
});

test("inspectOfflinePacks, downloadOfflinePack dedupe, abort, removeOfflinePack, and clearAllOfflineMedia", async () => {
  const cs = makeMemCacheStorage();
  const pack: OfflinePack = {
    id: "co-audio",
    title: "Test CO",
    desc: "desc",
    urls: ["https://app.test/materials/co/a.mp3", "https://app.test/materials/co/b.mp3", "https://app.test/materials/co/c.mp3"],
    estimatedBytes: 3000,
  };

  // Seed one pre-existing item so download skips it
  const cache = await cs.open(OFFLINE_MEDIA_CACHE);
  await cache.put(pack.urls[0], new Response(new Uint8Array(100), { status: 200, headers: { "Content-Length": "100" } }));

  const before = await inspectOfflinePacks([pack], cs);
  assert.equal(before[0].cached, 1);
  assert.equal(before[0].ready, false);

  const fetched: string[] = [];
  const res = await downloadOfflinePack(pack, {
    cacheStorage: cs,
    sameOrigin: "https://app.test",
    fetchImpl: async (input) => {
      const u = typeof input === "string" ? input : (input as Request).url;
      fetched.push(u);
      return new Response(new Uint8Array(250), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg", "Content-Length": "250" },
      });
    },
  });
  assert.equal(res.skipped, 1);
  assert.equal(res.cached, 3);
  assert.equal(res.bytesAdded, 500);
  assert.equal(fetched.length, 2);

  const after = await inspectOfflinePacks([pack], cs);
  assert.equal(after[0].ready, true);
  assert.equal(after[0].bytes, 600);

  const removed = await removeOfflinePack(pack, cs);
  assert.equal(removed, 3);
  assert.equal((await inspectOfflinePacks([pack], cs))[0].cached, 0);

  // Abort test
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    downloadOfflinePack(pack, { cacheStorage: cs, signal: ac.signal, fetchImpl: async () => new Response() }),
    { name: "AbortError" },
  );

  // clearAllOfflineMedia only wipes OFFLINE_MEDIA_CACHE & SW_MEDIA_CACHE
  await (await cs.open(SW_MEDIA_CACHE)).put("https://app.test/atlas/audio/f/a.mp3", new Response("ok"));
  await (await cs.open("atlas-v6-shell")).put("https://app.test/index.html", new Response("ok"));
  await clearAllOfflineMedia(cs);
  assert.equal(cs.stores.has(OFFLINE_MEDIA_CACHE), false);
  assert.equal(cs.stores.has(SW_MEDIA_CACHE), false);
  assert.equal(cs.stores.has("atlas-v6-shell"), true);
});

test("getOfflinePacks gathers 25 CO URLs and 18 RFI URLs cleanly", async () => {
  const packs = await getOfflinePacks(null, "/", "https://app.test");
  assert.equal(packs.length, 3);
  assert.equal(packs[0].id, "co-audio");
  assert.equal(packs[0].urls.length, 25);
  assert.equal(packs[1].id, "rfi-real");
  assert.equal(packs[1].urls.length, 18); // 6 * (.mp3 + .txt + .segments.json)
});
