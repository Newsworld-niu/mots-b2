import assert from "node:assert/strict";
import { test } from "node:test";
import { decryptSyncPayload, encryptSyncPayload, isEncryptedSyncPayload, SYNC_ENC_ALG } from "./crypto.ts";

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
