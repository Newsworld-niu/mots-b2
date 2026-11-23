/**
 * Client-side End-to-End Encryption (HKDF-SHA256 + AES-GCM-256) for cloud sync backups.
 * Keys are derived from the user's secret `syncCode` in WebCrypto so the sync server only
 * stores ciphertext while staying backward-compatible with legacy plaintext backups.
 */
export const SYNC_ENC_ALG = "aes-gcm-v1";
const SALT_BYTES = new TextEncoder().encode("mots-b2-sync-e2ee-salt-v1");

export interface EncryptedSyncEnvelope {
  app: "word-atlas";
  version: 2;
  enc: typeof SYNC_ENC_ALG;
  datasetId: string;
  iv: string;
  ct: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    const copy = new Uint8Array(new ArrayBuffer(buf.length));
    copy.set(buf);
    return copy;
  }
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toUtf8Buffer(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text);
  const copy = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  copy.set(encoded);
  return copy;
}

async function deriveAesKey(syncCode: string, datasetId: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("当前运行环境不支持 WebCrypto 加密");
  }
  const ikm = await subtle.importKey("raw", toUtf8Buffer(syncCode), "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: SALT_BYTES,
      info: toUtf8Buffer(`mots-b2-aes-gcm-256-v1:${datasetId}`),
    },
    ikm,
    { name: "AES-GCM", length: 256 },
    false,
    usage,
  );
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Generate a 256-bit cryptographically random local sync code (`mb2_` + 43 base64url chars). */
export function generateSyncCode(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("当前运行环境不支持安全随机数生成");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32));
  return `mb2_${toBase64Url(bytes)}`;
}

/**
 * Derive an independent bearer authentication token from `syncCode` via HKDF-SHA256.
 * The server authenticates requests using this derived token so the raw `syncCode` (encryption secret)
 * never leaves the browser.
 */
export async function deriveSyncAuthToken(syncCode: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("当前运行环境不支持 WebCrypto 密钥派生");
  }
  const ikm = await subtle.importKey("raw", toUtf8Buffer(syncCode), "HKDF", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toUtf8Buffer("word-atlas-sync-auth-salt-v2"),
      info: toUtf8Buffer("word-atlas:sync-auth:v2"),
    },
    ikm,
    256,
  );
  return `mb2a_${toBase64Url(new Uint8Array(bits))}`;
}

export function isEncryptedSyncPayload(raw: string): boolean {
  try {
    const p = JSON.parse(raw) as unknown;
    return isObj(p) && p.app === "word-atlas" && p.version === 2 && p.enc === SYNC_ENC_ALG;
  } catch {
    return false;
  }
}

export async function encryptSyncPayload(
  plaintextJson: string,
  syncCode: string,
  datasetId: string,
): Promise<string> {
  const key = await deriveAesKey(syncCode, datasetId, ["encrypt"]);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const aad = toUtf8Buffer(`word-atlas:v2:${datasetId}`);
  const plainBytes = toUtf8Buffer(plaintextJson);
  const cipherBuf = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad },
    key,
    plainBytes,
  );
  const env: EncryptedSyncEnvelope = {
    app: "word-atlas",
    version: 2,
    enc: SYNC_ENC_ALG,
    datasetId,
    iv: toBase64(iv),
    ct: toBase64(new Uint8Array(cipherBuf)),
  };
  return JSON.stringify(env);
}

export async function decryptSyncPayload(
  raw: string,
  syncCode: string,
  datasetId: string,
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!isObj(parsed) || parsed.enc !== SYNC_ENC_ALG) {
    return raw;
  }
  if (parsed.app !== "word-atlas" || parsed.version !== 2 || parsed.datasetId !== datasetId) {
    throw new Error("云端加密数据与当前词库不匹配");
  }
  if (typeof parsed.iv !== "string" || typeof parsed.ct !== "string") {
    throw new Error("云端加密数据格式无效");
  }
  const key = await deriveAesKey(syncCode, datasetId, ["decrypt"]);
  const aad = toUtf8Buffer(`word-atlas:v2:${datasetId}`);
  const iv = fromBase64(parsed.iv);
  const ct = fromBase64(parsed.ct);
  try {
    const plain = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      ct,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("云端备份解密失败：同步码不匹配或密文已被损坏");
  }
}
