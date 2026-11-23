import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createIdb } from "./idb.ts";

function makeFakeFactory() {
  let openCount = 0;
  let failOpens = 0;
  let failFirstTxInvalid = false;
  const instances: Array<{
    closeCalls: number;
    onclose: (() => void) | null;
    onversionchange: (() => void) | null;
  }> = [];
  const data = new Map<string, unknown>();

  const factory = {
    open() {
      openCount++;
      const req: any = { result: undefined, onsuccess: null, onerror: null, onupgradeneeded: null };
      queueMicrotask(() => {
        if (failOpens > 0) {
          failOpens--;
          req.onerror?.();
          return;
        }
        const meta = { closeCalls: 0, onclose: null as (() => void) | null, onversionchange: null as (() => void) | null };
        instances.push(meta);
        const db: any = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => {},
          close() {
            meta.closeCalls++;
          },
          set onclose(fn: (() => void) | null) {
            meta.onclose = fn;
          },
          get onclose() {
            return meta.onclose;
          },
          set onversionchange(fn: (() => void) | null) {
            meta.onversionchange = fn;
          },
          get onversionchange() {
            return meta.onversionchange;
          },
          transaction() {
            if (failFirstTxInvalid) {
              failFirstTxInvalid = false;
              const err = new Error("database connection is closing");
              err.name = "InvalidStateError";
              throw err;
            }
            return {
              objectStore: () => ({
                put: (v: unknown, k: string) => {
                  const r: any = { result: undefined, onsuccess: null, onerror: null };
                  queueMicrotask(() => {
                    data.set(k, v);
                    r.result = k;
                    r.onsuccess?.();
                  });
                  return r;
                },
                get: (k: string) => {
                  const r: any = { result: undefined, onsuccess: null, onerror: null };
                  queueMicrotask(() => {
                    r.result = data.get(k);
                    r.onsuccess?.();
                  });
                  return r;
                },
              }),
            };
          },
        };
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };

  return {
    factory,
    get openCount() {
      return openCount;
    },
    setFailOpens(n: number) {
      failOpens = n;
    },
    setFailFirstTxInvalid(v: boolean) {
      failFirstTxInvalid = v;
    },
    instances,
  };
}

const origIndexedDB = (globalThis as Record<string, unknown>).indexedDB;

afterEach(() => {
  (globalThis as Record<string, unknown>).indexedDB = origIndexedDB;
});

test("createIdb reuses single connection, resets on close/versionchange, and retries InvalidStateError", async () => {
  const fake = makeFakeFactory();
  (globalThis as Record<string, unknown>).indexedDB = fake.factory;

  const idb = createIdb("test-db", 1, () => {});
  const [d1, d2] = await Promise.all([idb.open(), idb.open()]);
  assert.equal(d1, d2);
  assert.equal(fake.openCount, 1, "concurrent opens reuse one connection");

  // Trigger onclose -> next open creates a fresh connection
  fake.instances[0].onclose?.();
  await idb.tx("s", "readwrite", (s) => s.put("val1", "k1"));
  assert.equal(fake.openCount, 2);
  assert.equal(await idb.tx("s", "readonly", (s) => s.get("k1")), "val1");
  assert.equal(fake.openCount, 2);

  // Trigger onversionchange -> closes db and resets cache
  fake.instances[1].onversionchange?.();
  assert.equal(fake.instances[1].closeCalls, 1);
  await idb.open();
  assert.equal(fake.openCount, 3);

  // Stale handle throws InvalidStateError once -> automatically reopens and succeeds
  fake.setFailFirstTxInvalid(true);
  assert.equal(await idb.tx("s", "readonly", (s) => s.get("k1")), "val1");
  assert.equal(fake.openCount, 4);

  // Failed open does not poison cache
  idb.reset();
  fake.setFailOpens(1);
  assert.equal(await idb.open(), null);
  assert.ok(await idb.open());
});
