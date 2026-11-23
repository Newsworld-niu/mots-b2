import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  MAX_MEM_IMAGES,
  ensureImageLoaded,
  getImages,
  hasImage,
  loadImages,
  readAllImagesIdb,
  replaceImages,
  resetImagesForTest,
  setImage,
} from "./images.ts";

function makeFakeImagesDb() {
  const store = new Map<string, string>();
  const wrap = <T,>(fn: () => T) => {
    const req: any = { result: undefined, error: null, onsuccess: null, onerror: null };
    queueMicrotask(() => {
      try {
        req.result = fn();
        req.onsuccess?.();
      } catch (e) {
        req.error = e;
        req.onerror?.();
      }
    });
    return req;
  };
  return {
    store,
    factory: {
      open() {
        const req: any = { result: undefined, onsuccess: null, onupgradeneeded: null };
        queueMicrotask(() => {
          const db: any = {
            objectStoreNames: { contains: () => true },
            createObjectStore: () => undefined,
            close: () => undefined,
            transaction() {
              const tx: any = { oncomplete: null, onerror: null, onabort: null };
              let ops = 0;
              const done = () => {
                ops--;
                if (ops === 0) tx.oncomplete?.();
              };
              const run = <T,>(fn: () => T) => {
                ops++;
                const r = wrap(() => {
                  const res = fn();
                  queueMicrotask(done);
                  return res;
                });
                return r;
              };
              tx.objectStore = () => ({
                get: (k: string) => run(() => store.get(k)),
                getAllKeys: () => run(() => [...store.keys()]),
                getAll: () => run(() => [...store.values()]),
                put: (v: string, k: string) => run(() => store.set(k, v)),
                delete: (k: string) => run(() => store.delete(k)),
              });
              return tx;
            },
          };
          req.result = db;
          req.onupgradeneeded?.();
          req.onsuccess?.();
        });
        return req;
      },
    },
  };
}

const origIndexedDb = (globalThis as Record<string, unknown>).indexedDB;

afterEach(() => {
  resetImagesForTest();
  (globalThis as Record<string, unknown>).indexedDB = origIndexedDb;
});

test("images cache stays bounded to MAX_MEM_IMAGES while IDB preserves all images and reloads evicted ids", async () => {
  const idb = makeFakeImagesDb();
  (globalThis as Record<string, unknown>).indexedDB = idb.factory;

  const total = MAX_MEM_IMAGES + 15;
  const bulk: Record<string, string> = {};
  for (let i = 0; i < total; i++) {
    bulk[`w-${i}`] = `data:image/jpeg;base64,img${i}`;
  }
  await loadImages("word-atlas-open");
  await replaceImages(bulk);

  const inRam = getImages();
  assert.equal(Object.keys(inRam).length, MAX_MEM_IMAGES);
  assert.equal(inRam["w-0"], undefined);
  assert.equal(hasImage("w-0"), true);

  // readAllImagesIdb returns every image for full backup/export
  const all = await readAllImagesIdb();
  assert.equal(Object.keys(all).length, total);
  assert.equal(all["w-0"], "data:image/jpeg;base64,img0");

  // Reloading an evicted image brings it back into RAM without losing capacity bound
  const restored = await ensureImageLoaded("w-0");
  assert.equal(restored, "data:image/jpeg;base64,img0");
  assert.equal(getImages()["w-0"], "data:image/jpeg;base64,img0");
  assert.equal(Object.keys(getImages()).length, MAX_MEM_IMAGES);

  await setImage("w-0", null);
  assert.equal(hasImage("w-0"), false);
});
