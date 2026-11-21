import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cloudSyncHealthy } from "../lib/backup";
import { resetProgress, store } from "../store/store";
import {
  SyncApiError,
  SyncAuthError,
  SyncConflictError,
  SyncNetworkError,
  deleteAccount,
  getHistoryVersion,
  listHistory,
  pullSync,
  pushSync,
  registerInvite,
} from "./api";
import { canonicalHash } from "./decide";
import {
  pairWithCode,
  pushIfChanged,
  registerWithInvite,
  resolveConflict,
  restoreHistoryVersion,
  setSyncBaseUrlForTest,
  syncNow,
  unpairLocal,
  wipeCloudAccount,
} from "./engine";
import {
  LAST_LOCAL_KEY,
  SYNC_STORAGE_KEY,
  getLocalSafetyCopy,
  getSyncState,
  reloadSyncState,
  resetSyncState,
  saveLocalSafetyCopy,
  setSyncState,
} from "./state";

const sampleCard = { due: 100, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2 as const, seen: 1 };
const VALID_CODE = "mb2_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk1234";

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key(i: number) {
      return [...map.keys()][i] ?? null;
    },
    getItem(k: string) {
      return map.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
    },
    removeItem(k: string) {
      map.delete(k);
    },
    clear() {
      map.clear();
    },
  };
}

const origLocalStorage = (globalThis as Record<string, unknown>).localStorage;
const origWindow = (globalThis as Record<string, unknown>).window;
const origFetch = globalThis.fetch;

beforeEach(() => {
  const storage = makeMemoryStorage();
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: () => undefined,
  };
  setSyncBaseUrlForTest("https://sync.example.test");
  reloadSyncState();
  store.useDataset("francais-b2-lexicon");
  resetProgress();
});

afterEach(() => {
  resetSyncState();
  setSyncBaseUrlForTest("");
  globalThis.fetch = origFetch;
  (globalThis as Record<string, unknown>).localStorage = origLocalStorage;
  (globalThis as Record<string, unknown>).window = origWindow;
});

test("state persists only allowed keys to fb2.sync and keeps busy/conflict in memory", () => {
  setSyncState({
    code: VALID_CODE,
    baseEtag: "e1",
    lastSyncedHash: "h1",
    lastOkAt: 12345,
    lastError: null,
    busy: true,
    conflict: {
      localJson: "{}",
      remoteJson: "{}",
      remoteEtag: "e2",
      localSummary: { exported: null, cards: 0, essays: 0, texts: 0, lastDay: null },
      remoteSummary: { exported: null, cards: 1, essays: 0, texts: 0, lastDay: "2026-11-22" },
    },
  });

  const raw = globalThis.localStorage.getItem(SYNC_STORAGE_KEY);
  assert.ok(raw);
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ["baseEtag", "code", "lastError", "lastOkAt", "lastSyncedHash"]);
  assert.equal(parsed.busy, undefined);
  assert.equal(parsed.conflict, undefined);
  assert.equal(getSyncState().busy, true);
  assert.ok(getSyncState().conflict);

  reloadSyncState();
  assert.equal(getSyncState().busy, false);
  assert.equal(getSyncState().conflict, null);
  assert.equal(getSyncState().code, VALID_CODE);
});

test("saveLocalSafetyCopy ignores quota errors cleanly", () => {
  (globalThis.localStorage as unknown as { setItem: () => void }).setItem = () => {
    throw new Error("QuotaExceededError");
  };
  assert.doesNotThrow(() => saveLocalSafetyCopy('{"test":1}'));
  assert.equal(getLocalSafetyCopy(), null);
});

test("cloudSyncHealthy checks paired code and 7-day freshness", () => {
  const now = Date.UTC(2026, 10, 22);
  assert.equal(cloudSyncHealthy({ code: null, lastOkAt: now }, now), false);
  assert.equal(cloudSyncHealthy({ code: VALID_CODE, lastOkAt: null }, now), false);
  assert.equal(cloudSyncHealthy({ code: VALID_CODE, lastOkAt: now - 6 * 86_400_000 }, now), true);
  assert.equal(cloudSyncHealthy({ code: VALID_CODE, lastOkAt: now - 7 * 86_400_000 }, now), false);
});

test("api client handles register, pull, push, history, delete, auth/conflict errors, and timeout without keepalive", async () => {
  const seenInits: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seenInits.push({ url, init });
    if (url.endsWith("/api/register")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { inviteCode?: string };
      if (body.inviteCode === "bad") {
        return new Response(JSON.stringify({ error: "invalid_invite" }), { status: 403 });
      }
      return new Response(JSON.stringify({ syncCode: VALID_CODE }), { status: 201 });
    }
    if (url.endsWith("/api/sync/francais-b2-lexicon")) {
      if (init?.method === "GET") {
        if ((init.headers as Record<string, string>)["If-None-Match"] === "etag-1") {
          return new Response(null, { status: 304 });
        }
        return new Response('{"app":"word-atlas"}', { status: 200, headers: { ETag: "etag-1" } });
      }
      if (init?.method === "PUT") {
        const headers = init.headers as Record<string, string>;
        if (headers["If-Match"] === "stale") {
          return new Response(JSON.stringify({ error: "conflict" }), { status: 412 });
        }
        return new Response(JSON.stringify({ etag: "etag-2" }), { status: 200, headers: { ETag: "etag-2" } });
      }
    }
    if (url.endsWith("/api/sync/francais-b2-lexicon/history")) {
      return new Response(JSON.stringify([{ id: "v1", at: "2026-11-22T00:00:00Z", size: 120 }]), { status: 200 });
    }
    if (url.endsWith("/api/sync/francais-b2-lexicon/history/v1")) {
      return new Response('{"app":"word-atlas","version":2}', { status: 200 });
    }
    if (url.endsWith("/api/account")) {
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 401 });
  }) as typeof fetch;

  await assert.rejects(() => registerInvite("bad", "https://sync.example.test"), SyncApiError);
  assert.deepEqual(await registerInvite("ok", "https://sync.example.test"), { syncCode: VALID_CODE });

  const pulled = await pullSync(VALID_CODE, "francais-b2-lexicon", null, "https://sync.example.test");
  assert.equal(pulled.status, "ok");
  assert.equal((await pullSync(VALID_CODE, "francais-b2-lexicon", "etag-1", "https://sync.example.test")).status, "not-modified");

  const pushed = await pushSync(VALID_CODE, "francais-b2-lexicon", "{}", { ifNoneMatchStar: true }, "https://sync.example.test");
  assert.equal(pushed.etag, "etag-2");
  assert.equal(seenInits.at(-1)?.init?.keepalive, undefined);

  await assert.rejects(
    () => pushSync(VALID_CODE, "francais-b2-lexicon", "{}", { ifMatch: "stale" }, "https://sync.example.test"),
    SyncConflictError,
  );
  assert.equal((await listHistory(VALID_CODE, "francais-b2-lexicon", "https://sync.example.test")).length, 1);
  assert.match(await getHistoryVersion(VALID_CODE, "francais-b2-lexicon", "v1", "https://sync.example.test"), /word-atlas/);
  await deleteAccount(VALID_CODE, "https://sync.example.test");

  globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;
  await assert.rejects(() => pullSync(VALID_CODE, "francais-b2-lexicon", null, "https://sync.example.test"), SyncAuthError);

  globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as typeof fetch;
  await assert.rejects(() => pullSync(VALID_CODE, "francais-b2-lexicon", null, "https://sync.example.test", 15), SyncNetworkError);
});

test("engine register, pair, conflict resolution, history restore, and wipe work end-to-end", async () => {
  let cloudBody: string | null = null;
  let cloudEtag = 0;
  const history: Array<{ id: string; at: string; size: number; body: string }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    if (url.endsWith("/api/register")) {
      return new Response(JSON.stringify({ syncCode: VALID_CODE }), { status: 201 });
    }
    if (headers.Authorization !== `Bearer ${VALID_CODE}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
    }
    if (url.endsWith("/api/sync/francais-b2-lexicon")) {
      if (init?.method === "GET") {
        if (!cloudBody) return new Response(null, { status: 404 });
        const curEtag = `"e${cloudEtag}"`;
        if (headers["If-None-Match"] === curEtag) return new Response(null, { status: 304 });
        return new Response(cloudBody, { status: 200, headers: { ETag: curEtag } });
      }
      if (init?.method === "PUT") {
        const curEtag = cloudBody ? `"e${cloudEtag}"` : null;
        if (headers["If-None-Match"] === "*" && cloudBody) {
          return new Response(JSON.stringify({ error: "conflict" }), { status: 412 });
        }
        if (headers["If-Match"] && headers["If-Match"] !== curEtag) {
          return new Response(JSON.stringify({ error: "conflict" }), { status: 412 });
        }
        if (cloudBody) {
          history.unshift({ id: `v${cloudEtag}`, at: new Date().toISOString(), size: cloudBody.length, body: cloudBody });
        }
        cloudBody = String(init.body ?? "");
        cloudEtag++;
        const nextEtag = `"e${cloudEtag}"`;
        return new Response(JSON.stringify({ etag: nextEtag }), { status: 200, headers: { ETag: nextEtag } });
      }
    }
    if (url.endsWith("/api/sync/francais-b2-lexicon/history")) {
      return new Response(JSON.stringify(history.map(({ id, at, size }) => ({ id, at, size }))), { status: 200 });
    }
    if (url.includes("/api/sync/francais-b2-lexicon/history/")) {
      const id = url.split("/").pop()!;
      const item = history.find((h) => h.id === id);
      if (!item) return new Response(null, { status: 404 });
      return new Response(item.body, { status: 200 });
    }
    if (url.endsWith("/api/account") && init?.method === "DELETE") {
      cloudBody = null;
      history.length = 0;
      return new Response(null, { status: 204 });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  // 1. Register on Device A with existing card progress -> auto push-creates
  store.progress((p) => ({ ...p, cards: { bonjour: sampleCard } }));
  const code = await registerWithInvite("inv_demo");
  assert.equal(code, VALID_CODE);
  assert.ok(cloudBody);
  assert.equal(getSyncState().baseEtag, '"e1"');
  assert.ok(getSyncState().lastSyncedHash);

  // 2. Edit locally and pushIfChanged -> pushes v2 and records history v1
  store.progress((p) => ({ ...p, cards: { ...p.cards, merci: sampleCard } }));
  await pushIfChanged();
  assert.equal(getSyncState().baseEtag, '"e2"');
  assert.equal(history.length, 1);

  // 3. Unpair locally, reset local progress (simulate fresh Device B), pairWithCode -> apply-remote!
  unpairLocal();
  resetProgress();
  assert.equal(Object.keys(store.get().progress.cards).length, 0);
  const dec = await pairWithCode(VALID_CODE);
  assert.equal(dec, "apply-remote");
  assert.deepEqual(Object.keys(store.get().progress.cards).sort(), ["bonjour", "merci"]);
  assert.ok(globalThis.localStorage.getItem(LAST_LOCAL_KEY));

  // 4. Simulate conflict: remote advances externally and local changes too
  const remoteObj = JSON.parse(cloudBody!) as Record<string, unknown>;
  (remoteObj.progress as Record<string, unknown>).cards = { ...((remoteObj.progress as Record<string, unknown>).cards as object), salut: sampleCard };
  cloudBody = JSON.stringify(remoteObj);
  cloudEtag++;
  store.progress((p) => ({ ...p, cards: { ...p.cards, au_revoir: sampleCard } }));

  const conflictDec = await syncNow();
  assert.equal(conflictDec, "conflict");
  assert.ok(getSyncState().conflict);
  assert.equal(getSyncState().conflict?.remoteSummary.cards, 3);
  assert.equal(getSyncState().conflict?.localSummary.cards, 3);

  // Resolve using remote -> applies remote and saves pre-overwrite safety copy
  const okRemote = await resolveConflict("remote");
  assert.equal(okRemote, true);
  assert.equal(getSyncState().conflict, null);
  assert.ok(store.get().progress.cards.salut);
  assert.equal(store.get().progress.cards.au_revoir, undefined);
  assert.match(getLocalSafetyCopy() ?? "", /au_revoir/);

  // 5. Restore history version v1 (which only had "bonjour") -> applies locally and pushes to cloud
  const restored = await restoreHistoryVersion("v1");
  assert.equal(restored, true);
  assert.deepEqual(Object.keys(store.get().progress.cards), ["bonjour"]);
  assert.equal(await canonicalHash(cloudBody!), getSyncState().lastSyncedHash);

  // 6. Network error maps silently to friendly message
  globalThis.fetch = (async () => {
    throw new TypeError("offline");
  }) as typeof fetch;
  await syncNow();
  assert.equal(getSyncState().lastError, "网络不可用，稍后自动重试");

  // 7. 401 maps to invalid code message
  globalThis.fetch = (async () => new Response(null, { status: 401 })) as typeof fetch;
  await syncNow();
  assert.equal(getSyncState().lastError, "同步码无效，请重新配对");

  // 8. Wipe cloud account clears local sync state too
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/api/account")) return new Response(null, { status: 204 });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  await wipeCloudAccount();
  assert.equal(getSyncState().code, null);
  assert.equal(globalThis.localStorage.getItem(SYNC_STORAGE_KEY), null);
});
