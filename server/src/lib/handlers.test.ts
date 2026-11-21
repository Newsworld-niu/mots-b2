import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { handleRequest, type HandlerEnv } from "./handlers.js";
import { MemoryObjStore, PreconditionFailedError } from "./store.js";

const ENV: HandlerEnv = {
  ADMIN_KEY: "test-admin-secret",
  ALLOWED_ORIGINS:
    "https://newsworld-niu.github.io,http://127.0.0.1:5190,http://localhost:5190,capacitor://localhost",
};

const DATASET_ID = "francais-b2-lexicon";

function makeBackup(datasetId = DATASET_ID, cardCount = 1): string {
  return JSON.stringify({
    app: "word-atlas",
    version: 2,
    exported: "2026-11-22T00:00:00.000Z",
    progress: {
      version: 2,
      datasetId,
      cards: { [`w${cardCount}`]: { reps: cardCount } },
    },
  });
}

async function createInviteAndRegister(
  store: MemoryObjStore,
  env: HandlerEnv = ENV,
): Promise<{ inviteCode: string; syncCode: string }> {
  const invRes = await handleRequest(
    {
      method: "POST",
      path: "/api/admin/invites",
      headers: { "x-admin-key": env.ADMIN_KEY },
      body: JSON.stringify({ count: 1 }),
    },
    store,
    env,
  );
  assert.equal(invRes.status, 201);
  const { invites } = JSON.parse(invRes.body!) as { invites: string[] };
  const inviteCode = invites[0];
  assert.match(inviteCode, /^inv_[A-Za-z0-9_-]+$/);

  const regRes = await handleRequest(
    {
      method: "POST",
      path: "/api/register",
      body: JSON.stringify({ inviteCode }),
    },
    store,
    env,
  );
  assert.equal(regRes.status, 201);
  const { syncCode } = JSON.parse(regRes.body!) as { syncCode: string };
  assert.match(syncCode, /^mb2_[A-Za-z0-9_-]{43}$/);
  return { inviteCode, syncCode };
}

describe("sync handlers", () => {
  it("normalizes /api and non-/api health paths", async () => {
    const store = new MemoryObjStore();
    const r1 = await handleRequest({ method: "GET", path: "/api/health" }, store, ENV);
    const r2 = await handleRequest({ method: "GET", path: "/health" }, store, ENV);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.deepEqual(JSON.parse(r1.body!), { ok: true });
    assert.deepEqual(JSON.parse(r2.body!), { ok: true });
  });

  it("enforces admin invites auth and count bounds", async () => {
    const store = new MemoryObjStore();

    const noKey = await handleRequest(
      { method: "POST", path: "/api/admin/invites" },
      store,
      ENV,
    );
    assert.equal(noKey.status, 401);

    const wrongKey = await handleRequest(
      {
        method: "POST",
        path: "/api/admin/invites",
        headers: { "X-Admin-Key": "wrong" },
      },
      store,
      ENV,
    );
    assert.equal(wrongKey.status, 401);

    const emptyEnv = await handleRequest(
      {
        method: "POST",
        path: "/api/admin/invites",
        headers: { "x-admin-key": "" },
      },
      store,
      { ...ENV, ADMIN_KEY: "" },
    );
    assert.equal(emptyEnv.status, 401);

    const badCount = await handleRequest(
      {
        method: "POST",
        path: "/api/admin/invites",
        headers: { "x-admin-key": ENV.ADMIN_KEY },
        body: JSON.stringify({ count: 21 }),
      },
      store,
      ENV,
    );
    assert.equal(badCount.status, 400);

    const ok = await handleRequest(
      {
        method: "POST",
        path: "/api/admin/invites",
        headers: { "x-admin-key": ENV.ADMIN_KEY },
        body: JSON.stringify({ count: 3 }),
      },
      store,
      ENV,
    );
    assert.equal(ok.status, 201);
    const parsed = JSON.parse(ok.body!) as { invites: string[] };
    assert.equal(parsed.invites.length, 3);
    assert.equal(new Set(parsed.invites).size, 3);
  });

  it("consumes invite once on register and rejects reuse or bogus invites", async () => {
    const store = new MemoryObjStore();
    const { inviteCode } = await createInviteAndRegister(store);

    const reuse = await handleRequest(
      {
        method: "POST",
        path: "/api/register",
        body: JSON.stringify({ inviteCode }),
      },
      store,
      ENV,
    );
    assert.equal(reuse.status, 403);
    assert.deepEqual(JSON.parse(reuse.body!), { error: "invalid_invite" });

    const bogus = await handleRequest(
      {
        method: "POST",
        path: "/api/register",
        body: JSON.stringify({ inviteCode: "inv_does_not_exist" }),
      },
      store,
      ENV,
    );
    assert.equal(bogus.status, 403);
    assert.deepEqual(JSON.parse(bogus.body!), { error: "invalid_invite" });

    const invRes = await handleRequest(
      {
        method: "POST",
        path: "/api/admin/invites",
        headers: { "x-admin-key": ENV.ADMIN_KEY },
        body: JSON.stringify({ count: 1 }),
      },
      store,
      ENV,
    );
    const raceCode = (JSON.parse(invRes.body!) as { invites: string[] }).invites[0];
    const [r1, r2] = await Promise.all([
      handleRequest(
        { method: "POST", path: "/api/register", body: JSON.stringify({ inviteCode: raceCode }) },
        store,
        ENV,
      ),
      handleRequest(
        { method: "POST", path: "/api/register", body: JSON.stringify({ inviteCode: raceCode }) },
        store,
        ENV,
      ),
    ]);
    assert.deepEqual([r1.status, r2.status].sort((a, b) => a - b), [201, 403]);
  });

  it("returns 401 when bearer auth is missing, malformed, or unregistered", async () => {
    const store = new MemoryObjStore();
    const fakeCode = "mb2_" + "A".repeat(43);

    for (const authHeader of [
      undefined,
      "Bearer short",
      `Basic ${fakeCode}`,
      `Bearer ${fakeCode}`,
    ]) {
      const headers: Record<string, string> = {};
      if (authHeader) headers.Authorization = authHeader;
      const res = await handleRequest(
        { method: "GET", path: `/api/sync/${DATASET_ID}`, headers },
        store,
        ENV,
      );
      assert.equal(res.status, 401);
      assert.deepEqual(JSON.parse(res.body!), { error: "unauthorized" });
    }
  });

  it("requires If-None-Match:* on first PUT, rejects missing precondition with 428, and supports 304 on GET", async () => {
    const store = new MemoryObjStore();
    const { syncCode } = await createInviteAndRegister(store);
    const auth = { Authorization: `Bearer ${syncCode}` };

    const missingBeforePut = await handleRequest(
      { method: "GET", path: `/api/sync/${DATASET_ID}`, headers: auth },
      store,
      ENV,
    );
    assert.equal(missingBeforePut.status, 404);

    const noCond = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: auth,
        body: makeBackup(),
      },
      store,
      ENV,
    );
    assert.equal(noCond.status, 428);

    const wrongCond = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": '"not-star"' },
        body: makeBackup(),
      },
      store,
      ENV,
    );
    assert.equal(wrongCond.status, 428);

    const payload = makeBackup(DATASET_ID, 7);
    const firstPut = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": "*" },
        body: payload,
      },
      store,
      ENV,
    );
    assert.equal(firstPut.status, 200);
    const { etag } = JSON.parse(firstPut.body!) as { etag: string };
    assert.ok(etag);
    assert.equal(firstPut.headers.ETag, etag);

    // Repeating If-None-Match:* once latest exists returns 412
    const duplicateCreate = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": "*" },
        body: payload,
      },
      store,
      ENV,
    );
    assert.equal(duplicateCreate.status, 412);

    const getOk = await handleRequest(
      { method: "GET", path: `/api/sync/${DATASET_ID}`, headers: auth },
      store,
      ENV,
    );
    assert.equal(getOk.status, 200);
    assert.equal(getOk.headers.ETag, etag);
    assert.equal(getOk.body, payload);

    const get304 = await handleRequest(
      {
        method: "GET",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": etag },
      },
      store,
      ENV,
    );
    assert.equal(get304.status, 304);
    assert.equal(get304.body, undefined);

    const getWildcard = await handleRequest(
      {
        method: "GET",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": "*" },
      },
      store,
      ENV,
    );
    assert.equal(getWildcard.status, 304);
    assert.equal(getWildcard.headers.ETag, etag);
    assert.equal(getWildcard.body, undefined);

    const getDifferentEtag = await handleRequest(
      {
        method: "GET",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": '"stale"' },
      },
      store,
      ENV,
    );
    assert.equal(getDifferentEtag.status, 200);
    assert.equal(getDifferentEtag.body, payload);
  });

  it("rejects stale If-Match with 412 without writing history", async () => {
    const store = new MemoryObjStore();
    const { syncCode } = await createInviteAndRegister(store);
    const auth = { Authorization: `Bearer ${syncCode}` };
    const ns = createHash("sha256").update(syncCode, "utf8").digest("hex");

    // If-Match when latest does not exist yet -> 412, no history
    const missingTarget = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-Match": '"1"' },
        body: makeBackup(),
      },
      store,
      ENV,
    );
    assert.equal(missingTarget.status, 412);
    assert.equal((await store.list(`users/${ns}/${DATASET_ID}/history/`)).length, 0);

    const p1 = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": "*" },
        body: makeBackup(DATASET_ID, 1),
      },
      store,
      ENV,
    );
    const etag1 = JSON.parse(p1.body!).etag as string;

    const p2 = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-Match": etag1 },
        body: makeBackup(DATASET_ID, 2),
      },
      store,
      ENV,
    );
    assert.equal(p2.status, 200);
    assert.equal((await store.list(`users/${ns}/${DATASET_ID}/history/`)).length, 1);

    // Now reuse stale etag1
    const stale = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-Match": etag1 },
        body: makeBackup(DATASET_ID, 3),
      },
      store,
      ENV,
    );
    assert.equal(stale.status, 412);
    assert.deepEqual(JSON.parse(stale.body!), { error: "conflict" });
    assert.equal((await store.list(`users/${ns}/${DATASET_ID}/history/`)).length, 1);

    const latest = await handleRequest(
      { method: "GET", path: `/api/sync/${DATASET_ID}`, headers: auth },
      store,
      ENV,
    );
    assert.equal(latest.body, makeBackup(DATASET_ID, 2));
  });

  it("caps history at newest 20 items and serves individual history blobs", async () => {
    const store = new MemoryObjStore();
    const { syncCode } = await createInviteAndRegister(store);
    const auth = { Authorization: `Bearer ${syncCode}` };

    const first = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": "*" },
        body: makeBackup(DATASET_ID, 0),
      },
      store,
      ENV,
    );
    let etag = JSON.parse(first.body!).etag as string;

    for (let i = 1; i <= 25; i++) {
      const res = await handleRequest(
        {
          method: "PUT",
          path: `/api/sync/${DATASET_ID}`,
          headers: { ...auth, "If-Match": etag },
          body: makeBackup(DATASET_ID, i),
        },
        store,
        ENV,
      );
      assert.equal(res.status, 200);
      etag = JSON.parse(res.body!).etag as string;
    }

    const histRes = await handleRequest(
      { method: "GET", path: `/api/sync/${DATASET_ID}/history`, headers: auth },
      store,
      ENV,
    );
    assert.equal(histRes.status, 200);
    const history = JSON.parse(histRes.body!) as Array<{
      id: string;
      at: string;
      size: number;
    }>;
    assert.equal(history.length, 20);
    for (const item of history) {
      assert.match(item.id, /^[A-Za-z0-9TZ._-]+$/);
      assert.ok(!Number.isNaN(Date.parse(item.at)));
      assert.ok(item.size > 0);
    }
    // Newest first: item[0] should be backup #24 (the previous latest before #25)
    const newestItemRes = await handleRequest(
      {
        method: "GET",
        path: `/api/sync/${DATASET_ID}/history/${history[0].id}`,
        headers: auth,
      },
      store,
      ENV,
    );
    assert.equal(newestItemRes.status, 200);
    assert.equal(newestItemRes.body, makeBackup(DATASET_ID, 24));

    const oldestRetainedRes = await handleRequest(
      {
        method: "GET",
        path: `/api/sync/${DATASET_ID}/history/${history[19].id}`,
        headers: auth,
      },
      store,
      ENV,
    );
    assert.equal(oldestRetainedRes.status, 200);
    assert.equal(oldestRetainedRes.body, makeBackup(DATASET_ID, 5));

    const badHistoryId = await handleRequest(
      {
        method: "GET",
        path: `/api/sync/${DATASET_ID}/history/..`,
        headers: auth,
      },
      store,
      ENV,
    );
    assert.equal(badHistoryId.status, 400);
  });

  it("rejects datasetId mismatches, invalid payloads, and >30MB bodies", async () => {
    const store = new MemoryObjStore();
    const { syncCode } = await createInviteAndRegister(store);
    const auth = { Authorization: `Bearer ${syncCode}`, "If-None-Match": "*" };

    const mismatch = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: auth,
        body: makeBackup("other-dataset"),
      },
      store,
      ENV,
    );
    assert.equal(mismatch.status, 400);

    const wrongVersion = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: auth,
        body: JSON.stringify({
          app: "word-atlas",
          version: 1,
          progress: { datasetId: DATASET_ID },
        }),
      },
      store,
      ENV,
    );
    assert.equal(wrongVersion.status, 400);

    const invalidDatasetParam = await handleRequest(
      {
        method: "GET",
        path: "/api/sync/Invalid_ID",
        headers: { Authorization: `Bearer ${syncCode}` },
      },
      store,
      ENV,
    );
    assert.equal(invalidDatasetParam.status, 400);

    const oversized = Buffer.alloc(30 * 1024 * 1024 + 1, 0x61);
    const tooBig = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: auth,
        body: oversized,
      },
      store,
      ENV,
    );
    assert.equal(tooBig.status, 413);
  });

  it("deletes all user blobs and invalidates syncCode on DELETE /api/account", async () => {
    const store = new MemoryObjStore();
    const { syncCode } = await createInviteAndRegister(store);
    const auth = { Authorization: `Bearer ${syncCode}` };
    const ns = createHash("sha256").update(syncCode, "utf8").digest("hex");

    const p1 = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": "*" },
        body: makeBackup(DATASET_ID, 1),
      },
      store,
      ENV,
    );
    const etag1 = JSON.parse(p1.body!).etag as string;
    await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-Match": etag1 },
        body: makeBackup(DATASET_ID, 2),
      },
      store,
      ENV,
    );

    assert.ok((await store.list(`users/${ns}/`)).length >= 3);

    const delRes = await handleRequest(
      { method: "DELETE", path: "/api/account", headers: auth },
      store,
      ENV,
    );
    assert.equal(delRes.status, 204);
    assert.equal((await store.list(`users/${ns}/`)).length, 0);

    const afterDelete = await handleRequest(
      { method: "GET", path: `/api/sync/${DATASET_ID}`, headers: auth },
      store,
      ENV,
    );
    assert.equal(afterDelete.status, 401);
  });

  it("applies CORS allowlist, exposes ETag, and handles OPTIONS preflight", async () => {
    const store = new MemoryObjStore();

    const allowedPreflight = await handleRequest(
      {
        method: "OPTIONS",
        path: `/api/sync/${DATASET_ID}`,
        headers: { Origin: "https://newsworld-niu.github.io" },
      },
      store,
      ENV,
    );
    assert.equal(allowedPreflight.status, 204);
    assert.equal(
      allowedPreflight.headers["Access-Control-Allow-Origin"],
      "https://newsworld-niu.github.io",
    );
    assert.equal(allowedPreflight.headers["Access-Control-Expose-Headers"], "ETag");
    assert.equal(allowedPreflight.headers.Vary, "Origin");
    assert.equal(allowedPreflight.headers["Cache-Control"], "no-store");
    assert.equal(allowedPreflight.headers["Access-Control-Max-Age"], "600");

    const disallowed = await handleRequest(
      {
        method: "GET",
        path: "/api/health",
        headers: { Origin: "https://evil.example" },
      },
      store,
      ENV,
    );
    assert.equal(disallowed.status, 200);
    assert.equal(disallowed.headers["Access-Control-Allow-Origin"], undefined);
    assert.equal(disallowed.headers["Access-Control-Expose-Headers"], "ETag");
    assert.equal(disallowed.headers.Vary, "Origin");

    const disallowedPreflight = await handleRequest(
      {
        method: "OPTIONS",
        path: "/api/register",
        headers: { Origin: "https://evil.example" },
      },
      store,
      ENV,
    );
    assert.equal(disallowedPreflight.status, 204);
    assert.equal(disallowedPreflight.headers["Access-Control-Allow-Origin"], undefined);

    const defaultFallback = await handleRequest(
      {
        method: "OPTIONS",
        path: `/api/sync/${DATASET_ID}`,
        headers: { Origin: "http://127.0.0.1:5190" },
      },
      store,
      { ADMIN_KEY: ENV.ADMIN_KEY },
    );
    assert.equal(defaultFallback.status, 204);
    assert.equal(
      defaultFallback.headers["Access-Control-Allow-Origin"],
      "http://127.0.0.1:5190",
    );
  });

  it("cleans up orphan history entry if conditional latest PUT races with 412", async () => {
    const baseStore = new MemoryObjStore();
    const { syncCode } = await createInviteAndRegister(baseStore);
    const auth = { Authorization: `Bearer ${syncCode}` };
    const ns = createHash("sha256").update(syncCode, "utf8").digest("hex");

    const p1 = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-None-Match": "*" },
        body: makeBackup(DATASET_ID, 1),
      },
      baseStore,
      ENV,
    );
    const etag1 = JSON.parse(p1.body!).etag as string;

    const racingStore: MemoryObjStore = Object.create(baseStore);
    racingStore.put = async (key, body, cond) => {
      if (key.endsWith("/latest.json") && cond?.ifMatch) {
        throw new PreconditionFailedError();
      }
      return baseStore.put(key, body, cond);
    };

    const raceRes = await handleRequest(
      {
        method: "PUT",
        path: `/api/sync/${DATASET_ID}`,
        headers: { ...auth, "If-Match": etag1 },
        body: makeBackup(DATASET_ID, 2),
      },
      racingStore,
      ENV,
    );
    assert.equal(raceRes.status, 412);
    assert.equal((await baseStore.list(`users/${ns}/${DATASET_ID}/history/`)).length, 0);
  });
});
