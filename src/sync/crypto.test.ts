import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptSyncPayload, decryptSyncPayloadVerified, encryptSyncPayload, isEncryptedSyncPayload, SYNC_ENC_ALG } from "./crypto.ts";

const CODE_A = "mb2_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk1234";
const CODE_B = "mb2_ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ1234";

test("encryptSyncPayload and decryptSyncPayload round-trip via HKDF + AES-GCM and reject wrong key/AAD/tamper", async () => {
  const plaintext = JSON.stringify({
    app: "word-atlas",
    version: 2,
    progress: { datasetId: "francais-b2-lexicon", cards: { entretien: { reps: 3 } } },
  });

  const c1 = await encryptSyncPayload(plaintext, CODE_A, "francais-b2-lexicon");
  const c2 = await encryptSyncPayload(plaintext, CODE_A, "francais-b2-lexicon");
  assert.notEqual(c1, c2, "fresh random IV every encryption");
  assert.equal(isEncryptedSyncPayload(c1), true);
  assert.equal(c1.includes("entretien"), false, "plaintext card data is hidden in ciphertext");

  const env = JSON.parse(c1) as { enc: string; ct: string };
  assert.equal(env.enc, SYNC_ENC_ALG);

  assert.equal(await decryptSyncPayload(c1, CODE_A, "francais-b2-lexicon"), plaintext);
  await assert.rejects(() => decryptSyncPayload(c1, CODE_B, "francais-b2-lexicon"), /解密失败/);
  await assert.rejects(() => decryptSyncPayload(c1, CODE_A, "other-dataset"), /不匹配/);

  const tampered = JSON.stringify({ ...env, app: "word-atlas", version: 2, datasetId: "francais-b2-lexicon", iv: JSON.parse(c1).iv, ct: env.ct.slice(0, -4) + "AAAA" });
  await assert.rejects(() => decryptSyncPayload(tampered, CODE_A, "francais-b2-lexicon"), /解密失败/);
});

test("decryptSyncPayload passes legacy plaintext backups through untouched", async () => {
  const legacy = JSON.stringify({ app: "word-atlas", version: 2, progress: { datasetId: "francais-b2-lexicon" } });
  assert.equal(isEncryptedSyncPayload(legacy), false);
  assert.equal(await decryptSyncPayload(legacy, CODE_A, "francais-b2-lexicon"), legacy);
});

test("isEncryptedSyncPayload accepts only the 6 envelope keys and decryptSyncPayloadVerified reports real encryption", async () => {
  const plain = JSON.stringify({ app: "word-atlas", version: 2, progress: { datasetId: "francais-b2-lexicon" }, aiConfig: { version: 1 } });
  const env = await encryptSyncPayload(plain, CODE_A, "francais-b2-lexicon");
  assert.equal(isEncryptedSyncPayload(env, "francais-b2-lexicon"), true);
  assert.equal(isEncryptedSyncPayload(env, "other-dataset"), false);
  const parsed = JSON.parse(env) as Record<string, unknown>;
  assert.equal(isEncryptedSyncPayload(JSON.stringify({ ...parsed, aiConfig: { keys: {} } })), false, "no plaintext riding along");
  assert.equal(isEncryptedSyncPayload(JSON.stringify({ ...parsed, iv: "" })), false);
  assert.equal(isEncryptedSyncPayload(JSON.stringify({ ...parsed, ct: 5 })), false);

  assert.deepEqual(await decryptSyncPayloadVerified(env, CODE_A, "francais-b2-lexicon"), { json: plain, encrypted: true });
  assert.deepEqual(await decryptSyncPayloadVerified(plain, CODE_A, "francais-b2-lexicon"), { json: plain, encrypted: false });
  await assert.rejects(() => decryptSyncPayloadVerified(JSON.stringify({ ...parsed, aiConfig: {} }), CODE_A, "francais-b2-lexicon"), /格式无效/);
  await assert.rejects(() => decryptSyncPayloadVerified(JSON.stringify({ ...parsed, enc: "none" }), CODE_A, "francais-b2-lexicon"), /格式无效/);
  await assert.rejects(() => decryptSyncPayloadVerified(env, CODE_B, "francais-b2-lexicon"), /解密失败/);
});
