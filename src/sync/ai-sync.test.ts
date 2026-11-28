import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { openaiJsonWith, transcribeAudio } from "../ai/clients";
import {
  CREDENTIAL_SLOTS,
  confirmSyncedBaseUrl,
  credentialOf,
  defaultAiConfig,
  getAiConfig,
  getUnconfirmedBaseUrls,
  reloadAiConfig,
  setAiConfig,
  toNonSensitiveAiConfig,
  type AiConfig,
  type SyncedAiKeys,
} from "../ai/config";
import { listGeminiModels } from "../ai/gemini";
import { assessViaWhisperVerbose } from "../ai/pronunciation";
import { AiError, errorFrom, redactSecrets } from "../ai/proxy";
import { sanitizeBackupJsonForDownload } from "../lib/backup";
import { exportBackupAsync, resetProgress, store, type Progress } from "../store/store";
import {
  AI_SYNC_STORAGE_KEY,
  aiSyncAccountFingerprint,
  bindAiSyncAccount,
  buildAiSyncPayload,
  getAiSyncPrefs,
  mergeAiSyncPayloads,
  onAiSyncPolicyDisabled,
  parseAiSyncPayload,
  reloadAiSyncPrefs,
  setSyncConfigEnabled,
  setSyncKeysEnabled,
  wouldIncludeKeysForAccount,
  type AiSyncPayload,
} from "./ai-sync";
import { SyncAuthError } from "./api";
import { decryptSyncPayloadVerified, deriveSyncAuthToken, encryptSyncPayload, isEncryptedSyncPayload } from "./crypto";
import { canonicalHash, hasBackupProgress } from "./decide";
import {
  ZERO_KNOWLEDGE_REQUIRED_FOR_KEYS,
  exportSyncPayloadAsync,
  getSyncHistory,
  pairWithCode,
  pushIfChanged,
  registerWithInvite,
  resolveConflict,
  restoreHistoryVersion,
  setSyncBaseUrlForTest,
  syncNow,
  unpairLocal,
} from "./engine";
import { mergeBackups } from "./merge";
import { SYNC_STORAGE_KEY, getSyncState, reloadSyncState, resetSyncState, setSyncState } from "./state";

const DATASET = "francais-b2-lexicon";
const sampleCard = { due: 100, s: 2, d: 5, el: 0, sd: 1, ls: 0, reps: 1, lapses: 0, st: 2 as const, seen: 1 };

const KEYS_A: SyncedAiKeys = {
  openai: "sk-A-openai-0123456789abcdef",
  deepseek: "sk-A-deepseek-0123456789abc",
  anthropic: "sk-ant-A-anthropic-0123456789",
  gemini: "AIzaSyA-gemini-key-0123456789",
  openrouter: "sk-or-A-openrouter-0123456789",
  azure: "azureAkey0123456789abcdef01234567",
  stt: "gsk_A_whisper_0123456789abcdef",
};
const KEYS_B: SyncedAiKeys = {
  openai: "sk-B-openai-private-9876543210",
  deepseek: "sk-B-deepseek-private-98765",
  anthropic: "sk-ant-B-private-9876543210",
  gemini: "AIzaSyB-gemini-private-98765",
  openrouter: "sk-or-B-private-9876543210",
  azure: "azureBprivatekey9876543210fedcba",
  stt: "gsk_B_whisper_private_987654",
};

/* ---------- a fake sync server shared by the simulated devices ---------- */

interface SeenRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

const cloud = {
  body: null as string | null,
  seq: 0,
  history: [] as Array<{ id: string; at: string; size: number; body: string }>,
  requests: [] as SeenRequest[],
  tokens: new Set<string>(),
  legacyTokens: new Set<string>(),
  /** Register like a legacy v1 server: hand out a server-generated code and accept it raw. */
  legacyCode: null as string | null,
  onSyncGet: null as (() => void) | null,
  failSyncPutBody: null as string | null,
  aiResponses: [] as string[],
};

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

function resetCloud() {
  cloud.body = null;
  cloud.seq = 0;
  cloud.history = [];
  cloud.requests = [];
  cloud.tokens = new Set();
  cloud.legacyTokens = new Set();
  cloud.legacyCode = null;
  cloud.onSyncGet = null;
  cloud.failSyncPutBody = null;
}

const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = { ...((init?.headers ?? {}) as Record<string, string>) };
  const body = typeof init?.body === "string" ? init.body : "";
  cloud.requests.push({ url, method, headers, body });
  if (url.includes("/ai-proxy/ping")) return new Response("no forwarder", { status: 404 });
  if (url.includes("/audio/transcriptions")) return json({ text: "bonjour" });
  if (url.includes("/chat/completions")) return json({ choices: [{ message: { content: '{"ok":true}' } }] });
  if (url.includes("/models")) return json({ models: [{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }] });
  if (!url.startsWith("https://sync.example.test")) return new Response(null, { status: 404 });

  if (url.endsWith("/api/register")) {
    const p = JSON.parse(body || "{}") as { authToken?: string };
    if (cloud.legacyCode) {
      cloud.tokens.add(cloud.legacyCode);
      return json({ syncCode: cloud.legacyCode }, 201);
    }
    if (!p.authToken) return json({ error: "bad" }, 400);
    cloud.tokens.add(p.authToken);
    return json({ authVersion: 2 }, 201);
  }
  if (url.endsWith("/api/auth/upgrade")) return new Response(null, { status: 404 });
  const bearer = (headers.Authorization ?? "").replace(/^Bearer /, "");
  if (!cloud.tokens.has(bearer)) return json({ error: "unauthorized" }, 401);
  if (url.endsWith("/api/auth") && method === "GET") {
    return json({ authVersion: 2, legacyAuth: cloud.legacyTokens.has(bearer) });
  }

  if (url.endsWith(`/api/sync/${DATASET}`)) {
    const cur = cloud.body ? `"e${cloud.seq}"` : null;
    if (method === "GET") {
      cloud.onSyncGet?.();
      if (!cloud.body) return new Response(null, { status: 404 });
      if (headers["If-None-Match"] === cur) return new Response(null, { status: 304 });
      return new Response(cloud.body, { status: 200, headers: { ETag: cur! } });
    }
    if (method === "PUT") {
      if (cloud.failSyncPutBody !== null) return json({ error: cloud.failSyncPutBody }, 500);
      // the real server's rule: aiConfig only ever inside an envelope with exactly the envelope keys
      const parsed = JSON.parse(body) as Record<string, unknown>;
      if ("aiConfig" in parsed) return json({ error: "invalid_payload" }, 400);
      if (headers["If-None-Match"] === "*" && cloud.body) return json({ error: "conflict" }, 412);
      if (headers["If-Match"] && headers["If-Match"] !== cur) return json({ error: "conflict" }, 412);
      if (cloud.body) cloud.history.unshift({ id: `v${cloud.seq}`, at: new Date().toISOString(), size: cloud.body.length, body: cloud.body });
      cloud.body = body;
      cloud.seq++;
      const next = `"e${cloud.seq}"`;
      return json({ etag: next }, 200, { ETag: next });
    }
  }
  if (url.endsWith(`/api/sync/${DATASET}/history`)) return json(cloud.history.map(({ id, at, size }) => ({ id, at, size })));
  if (url.includes(`/api/sync/${DATASET}/history/`)) {
    const item = cloud.history.find((h) => h.id === url.split("/").pop());
    return item ? new Response(item.body, { status: 200 }) : new Response(null, { status: 404 });
  }
  return new Response(null, { status: 404 });
}) as typeof fetch;

const puts = () => cloud.requests.filter((r) => r.method === "PUT" && r.url.includes("/api/sync/")).length;
const wireText = () => cloud.requests.map((r) => `${r.url}\n${JSON.stringify(r.headers)}\n${r.body}`).join("\n");

async function cloudPlain(code: string): Promise<{ json: string; data: Record<string, unknown>; ai: Record<string, unknown> | undefined }> {
  assert.ok(cloud.body, "cloud has an archive");
  assert.equal(isEncryptedSyncPayload(cloud.body, DATASET), true, "cloud holds a strict AES-GCM envelope");
  const v = await decryptSyncPayloadVerified(cloud.body, code, DATASET);
  assert.equal(v.encrypted, true);
  const data = JSON.parse(v.json) as Record<string, unknown>;
  return { json: v.json, data, ai: data.aiConfig as Record<string, unknown> | undefined };
}

/* ---------- simulated devices: each has its own localStorage and learning progress ---------- */

function makeMemoryStorage() {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

interface Device {
  storage: ReturnType<typeof makeMemoryStorage>;
  progress: Progress | null;
}
const newDevice = (): Device => ({ storage: makeMemoryStorage(), progress: null });
let current: Device | null = null;

function use(dev: Device) {
  if (current && current !== dev) current.progress = store.get().progress;
  (globalThis as Record<string, unknown>).localStorage = dev.storage;
  reloadSyncState();
  reloadAiConfig();
  reloadAiSyncPrefs();
  resetProgress();
  if (dev.progress) {
    const p = dev.progress;
    store.progress(() => p);
  }
  current = dev;
}

const addCard = (id: string) => store.progress((p) => ({ ...p, cards: { ...p.cards, [id]: sampleCard } }));

function setKeys(keys: Partial<SyncedAiKeys>) {
  setAiConfig((c) => {
    let next: AiConfig = { ...c, keys: { ...c.keys }, stt: { ...c.stt } };
    for (const [slot, v] of Object.entries(keys) as Array<[keyof SyncedAiKeys, string]>) {
      if (slot === "stt") next = { ...next, stt: { ...next.stt, apiKey: v } };
      else next = { ...next, keys: { ...next.keys, [slot]: v } };
    }
    return next;
  });
}

/** Device A's full non-sensitive setup: every job, custom endpoints, Azure and Whisper. */
function configureA() {
  setAiConfig((c) => ({
    ...c,
    openaiBaseUrl: "https://relay-a.example.com/v1",
    geminiBaseUrl: "https://gm-a.example.com",
    stt: { ...c.stt, provider: "custom", baseUrl: "https://stt-a.example.com/openai/v1", model: "whisper-large-v3-turbo" },
    azureRegion: "westeurope",
    azureVoice: "fr-FR-VivienneMultilingualNeural",
    azureVoiceMale: "fr-FR-RemyMultilingualNeural",
    tts: true,
    text: { provider: "openrouter", model: "google/gemini-2.5-flash" },
    vision: { provider: "gemini", model: "gemini-2.5-pro" },
    image: { provider: "openai", model: "gpt-image-1" },
    lastGoodModel: { gemini: "gemini-2.5-pro" },
  }));
}

const slotsOf = (c: AiConfig = getAiConfig()) => Object.fromEntries(CREDENTIAL_SLOTS.map((s) => [s, credentialOf(c, s)])) as SyncedAiKeys;

const origLocalStorage = (globalThis as Record<string, unknown>).localStorage;
const origWindow = (globalThis as Record<string, unknown>).window;
const origFetch = globalThis.fetch;

beforeEach(() => {
  (globalThis as Record<string, unknown>).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    addEventListener: () => undefined,
  };
  resetCloud();
  globalThis.fetch = fakeFetch;
  setSyncBaseUrlForTest("https://sync.example.test");
  current = null;
  store.useDataset(DATASET);
  store.settings({ onboarded: true });
});

afterEach(() => {
  resetSyncState();
  setSyncBaseUrlForTest("");
  globalThis.fetch = origFetch;
  (globalThis as Record<string, unknown>).localStorage = origLocalStorage;
  (globalThis as Record<string, unknown>).window = origWindow;
  current = null;
});

/* ---------- 1. non-sensitive config only ---------- */

test("non-sensitive AI config syncs A → B through E2EE while every credential slot of both devices stays local", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  configureA();
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_1");
  assert.equal(getAiSyncPrefs().keyPolicy, "unset", "API key sync is off by default");

  const { ai, json: plainA } = await cloudPlain(code);
  assert.ok(ai, "cloud archive carries aiConfig");
  assert.equal(ai.enabled, true);
  assert.equal(ai.includeKeys, false);
  assert.equal("keys" in ai, false, "no keys property at all");
  assert.equal("keyRevs" in ai, false);
  for (const k of Object.values(KEYS_A)) {
    assert.equal(plainA.includes(k), false, "decrypted cloud JSON never holds a key of A");
    assert.equal(wireText().includes(k), false, "no request URL, header or body holds a key of A");
  }
  assert.equal(wireText().includes("relay-a.example.com"), false, "even the base URL only travels encrypted");
  assert.equal(wireText().includes(code), false, "the raw sync code never leaves the device");

  // Device B: own private keys, default settings, no progress → pairing fast-applies the cloud
  const B = newDevice();
  use(B);
  setKeys(KEYS_B);
  const decision = await pairWithCode(code);
  assert.equal(decision, "apply-remote", "a device with only private keys is not a conflict");
  assert.ok(store.get().progress.cards.bonjour);
  const b = getAiConfig();
  assert.deepEqual(toNonSensitiveAiConfig(b), toNonSensitiveAiConfig({ ...defaultAiConfig(), ...JSON.parse(A.storage.getItem("word-atlas:ai:v1")!) }));
  assert.equal(b.text.provider, "openrouter");
  assert.equal(b.stt.baseUrl, "https://stt-a.example.com/openai/v1");
  assert.equal(b.azureVoiceMale, "fr-FR-RemyMultilingualNeural");
  assert.deepEqual(slotsOf(b), KEYS_B, "all 7 credential slots of B are untouched");
  const savedB = JSON.parse(B.storage.getItem("word-atlas:ai:v1")!) as AiConfig;
  assert.equal(savedB.keys.openai, KEYS_B.openai);
  assert.equal(savedB.stt.apiKey, KEYS_B.stt);

  // nothing was uploaded by B (its AI payload equals the cloud's), and two idle syncs upload nothing
  const putsAfterPair = puts();
  assert.equal(await syncNow(), "noop");
  assert.equal(await syncNow(), "noop");
  assert.equal(puts(), putsAfterPair, "idle syncs never PUT");
  for (const k of [...Object.values(KEYS_A), ...Object.values(KEYS_B)]) assert.equal(wireText().includes(k), false);

  // smart merge path: B learns a word and changes a voice while A changes the text model
  addCard("merci");
  setAiConfig({ azureVoice: "fr-FR-DeniseNeural" });
  use(A);
  setAiConfig({ text: { provider: "deepseek", model: "deepseek-chat" } });
  await pushIfChanged();
  use(B);
  assert.equal(await syncNow(), "merged");
  const merged = getAiConfig();
  assert.equal(merged.text.provider, "deepseek", "A's later config edit arrives");
  assert.deepEqual(slotsOf(merged), KEYS_B, "a merge never touches B's private keys");
  const after = await cloudPlain(code);
  for (const k of [...Object.values(KEYS_A), ...Object.values(KEYS_B)]) assert.equal(after.json.includes(k), false);
});

/* ---------- 2. a synced base URL never receives this device's private key unconfirmed ---------- */

test("a custom base URL changed by sync blocks requests with the local key until confirmed (OpenAI, Gemini, Whisper)", async () => {
  const A = newDevice();
  use(A);
  configureA();
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_2");

  const B = newDevice();
  use(B);
  setKeys(KEYS_B);
  setAiConfig((c) => ({ ...c, stt: { ...c.stt, provider: "custom", baseUrl: "https://stt-b.example.com/v1" } }));
  // B never shared anything: its only change is the STT mode, so it is a (manual) conflict on pairing
  const dec = await pairWithCode(code);
  if (dec === "conflict") assert.equal(await resolveConflict("remote"), true);
  assert.deepEqual(slotsOf(), KEYS_B, "B keeps its keys");
  assert.deepEqual(getUnconfirmedBaseUrls(), {
    openai: "https://relay-a.example.com/v1",
    gemini: "https://gm-a.example.com",
    stt: "https://stt-a.example.com/openai/v1",
  });

  const sent: string[] = [];
  const recFetch = (async (input: RequestInfo | URL) => {
    sent.push(String(input));
    return json({ choices: [{ message: { content: '{"ok":true}' } }] });
  }) as typeof fetch;
  const req = { system: "s", text: "t", schema: { type: "object" }, schemaName: "x" };
  const c = getAiConfig();
  await assert.rejects(() => openaiJsonWith("openai", "gpt-5-mini", req, { apiKey: c.keys.openai, openaiBaseUrl: c.openaiBaseUrl, fetcher: recFetch }), AiError);
  await assert.rejects(() => listGeminiModels({ apiKey: c.keys.gemini, geminiBaseUrl: c.geminiBaseUrl, fetcher: recFetch }), /确认启用该地址/);
  cloud.requests = [];
  await assert.rejects(() => transcribeAudio(new Blob(["x"], { type: "audio/webm" })), /云同步更新了/);
  await assert.rejects(() => assessViaWhisperVerbose(new Blob(["x"], { type: "audio/webm" }), undefined, { fetcher: recFetch }), /云同步更新了/);
  assert.equal(sent.length, 0, "nothing was sent to the unconfirmed hosts");
  assert.equal(cloud.requests.filter((r) => r.url.includes("stt-a.example.com")).length, 0);

  // a key-less call (no local key) is not blocked by the guard
  await openaiJsonWith("openai", "gpt-5-mini", req, { apiKey: "", openaiBaseUrl: c.openaiBaseUrl, fetcher: recFetch });
  assert.equal(sent.length, 1);

  confirmSyncedBaseUrl("openai");
  confirmSyncedBaseUrl("stt");
  await openaiJsonWith("openai", "gpt-5-mini", req, { apiKey: c.keys.openai, openaiBaseUrl: c.openaiBaseUrl, fetcher: recFetch });
  assert.equal(await transcribeAudio(new Blob(["x"], { type: "audio/webm" })), "bonjour");
  assert.ok(cloud.requests.some((r) => r.url.startsWith("https://stt-a.example.com/openai/v1/audio/transcriptions")));
  // editing the Gemini address (or key) by hand also counts as the learner's decision
  setAiConfig({ geminiBaseUrl: "https://gm-b.example.com" });
  assert.deepEqual(getUnconfirmedBaseUrls(), {});
  assert.deepEqual(slotsOf(), KEYS_B);
});

test("no endpoint guard when the device had no key for it, or when the key arrived together with the URL", async () => {
  const A = newDevice();
  use(A);
  setKeys({ openai: KEYS_A.openai });
  configureA();
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_2b");

  const B = newDevice();
  use(B);
  await pairWithCode(code);
  assert.deepEqual(getUnconfirmedBaseUrls(), {}, "keys and URL delivered together → nothing to confirm");
  assert.equal(getAiConfig().keys.openai, KEYS_A.openai);

  const C = newDevice();
  use(C);
  setAiConfig({ stt: { provider: "none", baseUrl: "", apiKey: "", model: "whisper-1" } });
  await pairWithCode(code);
  // C had no keys at all: it adopts the shared ones, no guard
  assert.deepEqual(getUnconfirmedBaseUrls(), {});
});

/* ---------- 3. full config + all 7 keys ---------- */

test("with API key sync on, all 7 credential slots travel only as AES-GCM ciphertext and a fresh device restores them and keeps sharing", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  configureA();
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_3");

  const firstPut = cloud.requests.find((r) => r.method === "PUT")!;
  assert.ok(firstPut.headers.Authorization.startsWith("Bearer mb2a_"), "derived zero-knowledge token");
  assert.equal(wireText().includes(code), false, "raw sync code never in any header or body");
  const env = JSON.parse(firstPut.body) as Record<string, unknown>;
  assert.deepEqual(Object.keys(env).sort(), ["app", "ct", "datasetId", "enc", "iv", "version"]);
  assert.equal(env.enc, "aes-gcm-v1");
  for (const k of Object.values(KEYS_A)) assert.equal(wireText().includes(k), false, "no key in clear on the wire");
  const { ai } = await cloudPlain(code);
  assert.equal(ai?.includeKeys, true);
  assert.deepEqual(ai?.keys, KEYS_A, "the decrypted archive holds all 7 slots");

  const B = newDevice();
  use(B);
  assert.equal(await pairWithCode(code), "apply-remote");
  assert.deepEqual(slotsOf(), KEYS_A, "all 7 keys restored on B");
  assert.deepEqual(toNonSensitiveAiConfig(getAiConfig()), toNonSensitiveAiConfig(JSON.parse(A.storage.getItem("word-atlas:ai:v1")!) as AiConfig));
  assert.equal(getAiSyncPrefs().keyPolicy, "enabled", "B keeps key sync on");

  // B studies and pushes: the shared keys stay in the cloud
  addCard("merci");
  await pushIfChanged();
  const latest = await cloudPlain(code);
  assert.ok((latest.data.progress as Progress).cards.merci);
  assert.equal(latest.ai?.includeKeys, true);
  assert.deepEqual(latest.ai?.keys, KEYS_A);
});

/* ---------- 4. private keys of a device that never opted in ---------- */

test("a device with private keys that never opted in carries the shared keys through and never uploads its own", async () => {
  const A = newDevice();
  use(A);
  setKeys({ gemini: KEYS_A.gemini });
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_4");

  const B = newDevice();
  use(B);
  setKeys({ openai: KEYS_B.openai });
  assert.equal(await pairWithCode(code), "apply-remote");
  assert.equal(getAiConfig().keys.openai, KEYS_B.openai, "private key kept");
  assert.equal(getAiConfig().keys.gemini, KEYS_A.gemini, "empty slot filled from the shared keys");
  assert.equal(getAiSyncPrefs().keyPolicy, "unset", "the switch stays off on B");
  assert.ok(getAiSyncPrefs().passthroughKeys);

  addCard("merci");
  await pushIfChanged();
  const { ai, json: plain } = await cloudPlain(code);
  assert.ok((JSON.parse(plain) as { progress: Progress }).progress.cards.merci, "B's progress was pushed");
  assert.equal(plain.includes(KEYS_B.openai), false, "B's private key never reaches the cloud");
  assert.equal(wireText().includes(KEYS_B.openai), false);
  assert.equal(ai?.includeKeys, true);
  assert.equal((ai?.keys as SyncedAiKeys).gemini, KEYS_A.gemini, "A's shared key survives B's push");
  assert.equal((ai?.keys as SyncedAiKeys).openai, "");

  // opting in on B later shares both
  setSyncKeysEnabled(true);
  await pushIfChanged();
  const opted = await cloudPlain(code);
  assert.equal((opted.ai?.keys as SyncedAiKeys).openai, KEYS_B.openai);
  assert.equal((opted.ai?.keys as SyncedAiKeys).gemini, KEYS_A.gemini);
});

/* ---------- 5. per-slot revisions ---------- */

test("per-slot keyRevs: A clears one key while B (offline) changes a voice; the merge keeps both and idle syncs never PUT", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_5");

  const B = newDevice();
  use(B);
  await pairWithCode(code);
  assert.deepEqual(slotsOf(), KEYS_A);
  setAiConfig({ azureVoice: "fr-FR-EloiseNeural" }); // offline edit, not pushed yet

  use(A);
  setKeys({ openai: "" });
  await pushIfChanged();
  assert.equal(((await cloudPlain(code)).ai?.keys as SyncedAiKeys).openai, "");

  use(B);
  assert.equal(await syncNow(), "merged");
  assert.equal(getAiConfig().keys.openai, "", "A's explicit clear wins (higher slot revision), not revived");
  assert.equal(getAiConfig().keys.gemini, KEYS_A.gemini);
  assert.equal(getAiConfig().azureVoice, "fr-FR-EloiseNeural", "B's voice edit kept");

  use(A);
  assert.equal(await syncNow(), "apply-remote");
  assert.equal(getAiConfig().azureVoice, "fr-FR-EloiseNeural");
  assert.equal(getAiConfig().keys.openai, "");

  const before = puts();
  assert.equal(await syncNow(), "noop");
  assert.equal(await syncNow(), "noop");
  use(B);
  assert.equal(await syncNow(), "noop");
  assert.equal(await syncNow(), "noop");
  assert.equal(puts(), before, "two idle syncs per device: zero extra PUTs");
  const { ai } = await cloudPlain(code);
  assert.equal((ai?.keyRevs as Record<string, number>).openai, 2);
});

/* ---------- 6. switching off ---------- */

test("switching key sync off removes keys from the cloud but keeps every local key; switching config sync off writes a tombstone", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  configureA();
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_6");
  const B = newDevice();
  use(B);
  await pairWithCode(code);
  assert.equal(getAiSyncPrefs().keyPolicy, "enabled");

  use(A);
  let fired = 0;
  const off = onAiSyncPolicyDisabled(() => fired++);
  setSyncKeysEnabled(false);
  off();
  assert.equal(fired, 1, "switching off asks the engine for an immediate push");
  await pushIfChanged();
  const saved = JSON.parse(A.storage.getItem("word-atlas:ai:v1")!) as AiConfig;
  assert.deepEqual(slotsOf(saved), KEYS_A, "all 7 keys still in A's localStorage");
  const { ai, json: plain } = await cloudPlain(code);
  assert.equal(ai?.includeKeys, false);
  assert.equal("keys" in (ai ?? {}), false);
  for (const k of Object.values(KEYS_A)) assert.equal(plain.includes(k), false, "the latest archive holds no key");

  use(B);
  await syncNow();
  assert.equal(getAiSyncPrefs().keyPolicy, "disabled", "the other device follows");
  assert.deepEqual(slotsOf(), KEYS_A, "and keeps its own copy of the keys");
  assert.equal(getAiConfig().text.provider, "openrouter");

  use(A);
  setSyncConfigEnabled(false);
  await pushIfChanged();
  const tomb = (await cloudPlain(code)).ai;
  assert.deepEqual(tomb, { version: 1, enabled: false, includeKeys: false, policyRev: getAiSyncPrefs().policyRev });
  assert.deepEqual(slotsOf(), KEYS_A);
  assert.equal(getAiConfig().azureRegion, "westeurope", "A's config kept");

  use(B);
  await syncNow();
  assert.equal(getAiSyncPrefs().configPolicy, "disabled");
  assert.equal(getAiConfig().azureRegion, "westeurope", "B's config kept as well");
  // B edits its config now: nothing AI-related leaves B any more
  setAiConfig({ azureRegion: "eastasia" });
  await pushIfChanged();
  assert.equal(JSON.stringify((await cloudPlain(code)).ai).includes("eastasia"), false);
});

test("a local switch-off made offline beats an older remote that still shares keys (newer policyRev wins the merge)", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_6b");
  const B = newDevice();
  use(B);
  await pairWithCode(code);
  setSyncKeysEnabled(false); // offline: not pushed
  use(A);
  addCard("merci");
  await pushIfChanged();
  use(B);
  assert.equal(await syncNow(), "merged");
  assert.equal(getAiSyncPrefs().keyPolicy, "disabled");
  const { ai, data } = await cloudPlain(code);
  assert.ok((data.progress as Progress).cards.merci);
  assert.equal(ai?.includeKeys, false);
  assert.equal("keys" in (ai ?? {}), false);
});

/* ---------- 7. legacy archives, plaintext attacks, history ---------- */

test("legacy archives without aiConfig and untrusted plaintext aiConfig never touch the local AI settings", async () => {
  const B = newDevice();
  use(B);
  setKeys(KEYS_B);
  const code = "mb2_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk1234";
  const { deriveSyncAuthToken } = await import("./crypto");
  cloud.tokens.add(await deriveSyncAuthToken(code));

  // (a) an old encrypted archive with no aiConfig
  const legacy = { app: "word-atlas", version: 2, exported: "2026-11-22T00:00:00.000Z", progress: { version: 2, datasetId: DATASET, cards: { salut: sampleCard } } };
  cloud.body = await encryptSyncPayload(JSON.stringify(legacy), code, DATASET);
  cloud.seq = 1;
  const before = JSON.stringify(getAiConfig());
  assert.equal(await pairWithCode(code), "apply-remote");
  assert.ok(store.get().progress.cards.salut);
  assert.equal(JSON.stringify(getAiConfig()), before, "AI settings untouched");
  assert.equal(puts(), 0, "a pristine device does not rewrite a legacy archive");

  // (b) a plaintext archive (served by a malicious server) carrying aiConfig with keys
  unpairLocal();
  resetProgress();
  const forged = {
    ...legacy,
    aiConfig: { version: 1, enabled: true, includeKeys: true, policyRev: 99, configRev: 99, config: { ...toNonSensitiveAiConfig(defaultAiConfig()), openaiBaseUrl: "https://evil.example.com" }, keys: { ...KEYS_A }, keyRevs: { openai: 99 } },
  };
  cloud.body = JSON.stringify(forged);
  cloud.seq = 2;
  await pairWithCode(code);
  assert.equal(getAiConfig().openaiBaseUrl, "", "untrusted plaintext aiConfig ignored");
  assert.deepEqual(slotsOf(), KEYS_B);
  assert.equal(getAiSyncPrefs().policyRev, 0);

  // (c) an encrypted aiConfig with includeKeys:false smuggling keys: the keys are dropped
  const smuggled = parseAiSyncPayload({ version: 1, enabled: true, includeKeys: false, policyRev: 1, configRev: 1, config: {}, keys: KEYS_A });
  assert.ok(smuggled && smuggled.enabled);
  assert.equal("keys" in smuggled, false);
  // (d) an unknown future version is ignored
  assert.equal(parseAiSyncPayload({ version: 2, enabled: true, includeKeys: true, keys: KEYS_A }), null);
  // (e) a forged stt.apiKey inside config never becomes a credential
  const sneaky = parseAiSyncPayload({ version: 1, enabled: true, includeKeys: false, policyRev: 0, configRev: 1, config: { stt: { provider: "custom", baseUrl: "https://x.example.com", apiKey: KEYS_A.stt } } });
  assert.equal(JSON.stringify(sneaky).includes(KEYS_A.stt), false);
});

test("history restore after key sync was switched off never brings historical keys back locally or into the cloud", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_7");
  const withKeysId = "v1";
  addCard("merci");
  await pushIfChanged(); // history v1 = the archive holding the keys
  assert.ok(cloud.history.find((h) => h.id === withKeysId));

  setSyncKeysEnabled(false);
  setKeys({ openai: "sk-A-rotated-new-key-777777" });
  await pushIfChanged();
  assert.equal((await getSyncHistory()).length >= 2, true);

  assert.equal(await restoreHistoryVersion(withKeysId), true);
  assert.deepEqual(Object.keys(store.get().progress.cards), ["bonjour"], "learning data restored");
  assert.equal(getAiConfig().keys.openai, "sk-A-rotated-new-key-777777", "historical key not imported");
  assert.equal(getAiSyncPrefs().keyPolicy, "disabled");
  const { ai, json: plain } = await cloudPlain(code);
  assert.equal(ai?.includeKeys, false, "restore cannot revive keys in the cloud");
  for (const k of Object.values(KEYS_A)) assert.equal(plain.includes(k), false);
  assert.equal(plain.includes("sk-A-rotated-new-key-777777"), false);
  assert.equal(await canonicalHash(plain), getSyncState().lastSyncedHash);
});

test("history restore with key sync on restores snapshot keys only into slots it has, newer than the cloud's", async () => {
  const A = newDevice();
  use(A);
  setKeys({ gemini: KEYS_A.gemini });
  setSyncKeysEnabled(true);
  addCard("bonjour");
  await registerWithInvite("inv_ai_7b");
  addCard("merci");
  await pushIfChanged();
  setKeys({ gemini: "AIzaSy-rotated-gemini-000000", openai: KEYS_A.openai });
  await pushIfChanged();
  assert.equal(await restoreHistoryVersion("v1"), true);
  assert.equal(getAiConfig().keys.gemini, KEYS_A.gemini, "snapshot key restored");
  assert.equal(getAiConfig().keys.openai, KEYS_A.openai, "a slot empty in the snapshot keeps the current key");
});

test("a corrupt history snapshot is rejected before anything local changes", async () => {
  const A = newDevice();
  use(A);
  addCard("bonjour");
  const code = await registerWithInvite("inv_ai_7c");
  addCard("merci");
  await pushIfChanged();
  cloud.history[0].body = await encryptSyncPayload(JSON.stringify({ app: "word-atlas", version: 2, progress: { datasetId: "other" } }), code, DATASET);
  await assert.rejects(() => restoreHistoryVersion(cloud.history[0].id), /历史版本数据无效/);
  assert.deepEqual(Object.keys(store.get().progress.cards).sort(), ["bonjour", "merci"]);
});

/* ---------- 8. backups and downloads ---------- */

test("manual backups never hold aiConfig or keys, and downloads strip aiConfig but keep arrays", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const manual = await exportBackupAsync();
  assert.equal(manual.includes("aiConfig"), false);
  for (const k of Object.values(KEYS_A)) assert.equal(manual.includes(k), false);

  const synced = await exportSyncPayloadAsync();
  assert.equal(synced.includes(KEYS_A.openai), true, "only the encrypted sync payload carries them");
  const safe = sanitizeBackupJsonForDownload(synced)!;
  assert.equal(safe.includes("aiConfig"), false);
  for (const k of Object.values(KEYS_A)) assert.equal(safe.includes(k), false);
  assert.ok((JSON.parse(safe) as { progress: Progress }).progress.cards.bonjour);
  assert.equal(sanitizeBackupJsonForDownload("[]"), "[]", "dictionary report arrays pass through");
  assert.equal(sanitizeBackupJsonForDownload('[{"id":"r1"}]'), '[{"id":"r1"}]');
  assert.equal(sanitizeBackupJsonForDownload('{"aiConfig": {"keys": '), null, "unparseable text mentioning aiConfig is refused");
  assert.equal(sanitizeBackupJsonForDownload("not json"), "not json");
});

test("the sync payload is deterministic: no edits, same hash", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  configureA();
  setSyncKeysEnabled(true);
  const h1 = await canonicalHash(await exportSyncPayloadAsync());
  await new Promise((r) => setTimeout(r, 5));
  const h2 = await canonicalHash(await exportSyncPayloadAsync());
  assert.equal(h1, h2);
  // a pristine device emits no aiConfig at all
  const P = newDevice();
  use(P);
  setKeys(KEYS_B);
  assert.equal(buildAiSyncPayload(), null);
  assert.equal((await exportSyncPayloadAsync()).includes("aiConfig"), false);
});

/* ---------- 9. zero knowledge ---------- */

test("with key sync on, a 401 on the derived token never falls back to the raw code; legacy accounts never upload keys", async () => {
  const B = newDevice();
  use(B);
  setKeys(KEYS_B);
  setSyncKeysEnabled(true);
  const code = "mb2_ZYXWVUTSRQPONMLKJIHGFEDCBAzyxwvutsrqpon9876";
  cloud.tokens.add(code); // a server that only accepts the raw code
  cloud.requests = [];
  await assert.rejects(() => pairWithCode(code), SyncAuthError);
  assert.equal(cloud.requests.some((r) => (r.headers.Authorization ?? "").includes(code)), false, "raw code never sent");
  assert.equal(getSyncState().code, null);

  // a legacy v1 server that generates the code itself: keys are refused, nothing with keys is uploaded
  unpairLocal();
  const C = newDevice();
  use(C);
  setKeys(KEYS_A);
  setSyncKeysEnabled(true);
  addCard("bonjour");
  cloud.legacyCode = "mb2_LEGACYLEGACYLEGACYLEGACYLEGACYLEGACY12345";
  await registerWithInvite("inv_legacy");
  assert.equal(getSyncState().legacyAuth, true);
  assert.equal(getSyncState().lastError, ZERO_KNOWLEDGE_REQUIRED_FOR_KEYS);
  assert.equal(puts(), 0);
  for (const k of Object.values(KEYS_A)) assert.equal(wireText().includes(k), false);
  const persisted = JSON.parse(C.storage.getItem(SYNC_STORAGE_KEY)!) as Record<string, unknown>;
  assert.equal(persisted.legacyAuth, true);
  // switching key sync off lets progress sync again
  setSyncKeysEnabled(false);
  await syncNow();
  assert.equal(getSyncState().lastError, null);
  assert.equal(puts(), 1);
});

test("v2 sync state never persists legacyAuth (default 6 keys)", () => {
  const D = newDevice();
  use(D);
  setSyncState({ code: "mb2_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijk1234", authVersion: 2, baseEtag: "e", lastSyncedHash: "h", lastOkAt: 1, lastError: null });
  const parsed = JSON.parse(D.storage.getItem(SYNC_STORAGE_KEY)!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ["authVersion", "baseEtag", "code", "lastError", "lastOkAt", "lastSyncedHash"]);
});

/* ---------- 10. account isolation, progress detection, merging ---------- */

test("pairing another account never inherits the key upload consent", async () => {
  const D = newDevice();
  use(D);
  setKeys(KEYS_A);
  const fp1 = await aiSyncAccountFingerprint("mb2_account_one_aaaaaaaaaaaaaaaaaaaa");
  const fp2 = await aiSyncAccountFingerprint("mb2_account_two_bbbbbbbbbbbbbbbbbbbb");
  assert.match(fp1, /^[0-9a-f]{32}$/);
  assert.notEqual(fp1, fp2);
  setSyncKeysEnabled(true); // chosen before the first pairing
  bindAiSyncAccount(fp1);
  assert.equal(getAiSyncPrefs().keyPolicy, "enabled", "a preset before pairing is kept");
  assert.equal(wouldIncludeKeysForAccount(fp1), true);
  assert.equal(wouldIncludeKeysForAccount(fp2), false);
  bindAiSyncAccount(fp2);
  const p = getAiSyncPrefs();
  assert.equal(p.keyPolicy, "unset");
  assert.equal(p.configPolicy, "unset", "switching accounts resets to pristine unset state");
  assert.equal(p.policyRev, 0);
  assert.equal(p.passthroughKeys, null);
  assert.deepEqual(slotsOf(), KEYS_A, "local keys untouched");
  assert.equal(JSON.parse(D.storage.getItem(AI_SYNC_STORAGE_KEY)!).accountFp, fp2);
  assert.equal(D.storage.getItem(AI_SYNC_STORAGE_KEY)!.includes("account_two"), false, "the code itself is never stored");
});

test("hasBackupProgress counts real AI choices but not a default device with private keys", () => {
  const base = { app: "word-atlas", version: 2, progress: { version: 2, datasetId: DATASET, cards: {} } };
  const cfg = toNonSensitiveAiConfig(defaultAiConfig());
  assert.equal(hasBackupProgress(JSON.stringify(base)), false);
  assert.equal(hasBackupProgress(JSON.stringify({ ...base, aiConfig: { version: 1, enabled: true, includeKeys: false, policyRev: 0, configRev: 0, config: cfg } })), false);
  assert.equal(hasBackupProgress(JSON.stringify({ ...base, aiConfig: { version: 1, enabled: true, includeKeys: false, policyRev: 0, configRev: 2, config: cfg } })), true);
  assert.equal(hasBackupProgress(JSON.stringify({ ...base, aiConfig: { version: 1, enabled: true, includeKeys: false, policyRev: 0, configRev: 0, config: { ...cfg, azureRegion: "eastasia" } } })), true);
  assert.equal(hasBackupProgress(JSON.stringify({ ...base, aiConfig: { version: 1, enabled: false, includeKeys: false, policyRev: 1 } })), true);
  assert.equal(hasBackupProgress(JSON.stringify({ ...base, aiConfig: { version: 1, enabled: true, includeKeys: true, policyRev: 0, configRev: 0, config: cfg, keys: { openai: "sk-x-1234567890" } } })), true);
  assert.equal(hasBackupProgress(JSON.stringify({ ...base, aiConfig: { version: 9 } })), false);
});

test("mergeAiSyncPayloads: newer policy wins, switching off wins ties, config by configRev, keys slot by slot", () => {
  const cfg = toNonSensitiveAiConfig(defaultAiConfig());
  const keys = (o: Partial<SyncedAiKeys>): SyncedAiKeys => ({ openai: "", deepseek: "", anthropic: "", gemini: "", openrouter: "", azure: "", stt: "", ...o });
  const on = (policyRev: number, configRev: number, k: Partial<SyncedAiKeys>, keyRevs: Record<string, number>, extra: Partial<typeof cfg> = {}): AiSyncPayload => ({
    version: 1,
    enabled: true,
    includeKeys: true,
    policyRev,
    configRev,
    config: { ...cfg, ...extra },
    keys: keys(k),
    keyRevs,
  });
  const offKeys: AiSyncPayload = { version: 1, enabled: true, includeKeys: false, policyRev: 3, configRev: 1, config: cfg };
  const tomb: AiSyncPayload = { version: 1, enabled: false, includeKeys: false, policyRev: 3 };

  assert.deepEqual(mergeAiSyncPayloads(on(3, 1, { openai: "a" }, { openai: 1 }), tomb), tomb, "tie → off wins");
  assert.equal(mergeAiSyncPayloads(on(3, 1, { openai: "a" }, { openai: 1 }), offKeys)?.includeKeys, false);
  assert.equal(mergeAiSyncPayloads(on(4, 1, { openai: "a" }, { openai: 1 }), tomb)?.enabled, true, "a newer switch-on wins");
  const m = mergeAiSyncPayloads(on(2, 5, { openai: "", gemini: "g1" }, { openai: 3, gemini: 1 }, { azureVoice: "fr-FR-X" }), on(2, 4, { openai: "o1", gemini: "g2" }, { openai: 2, gemini: 2 }, { azureVoice: "fr-FR-Y" }));
  assert.ok(m && m.enabled && m.includeKeys);
  assert.equal(m.config.azureVoice, "fr-FR-X", "higher configRev wins");
  assert.equal(m.keys?.openai, "", "explicit clear with the higher rev wins");
  assert.equal(m.keys?.gemini, "g2");
  assert.deepEqual(m.keyRevs, { openai: 3, gemini: 2 });

  // mergeBackups carries the merged aiConfig
  const backup = (ai: AiSyncPayload) => JSON.stringify({ app: "word-atlas", version: 2, progress: { version: 2, datasetId: DATASET, cards: {} }, aiConfig: ai });
  const merged = mergeBackups(backup(on(3, 1, { openai: "a" }, { openai: 1 })), backup(tomb));
  assert.ok(merged.ok);
  assert.deepEqual((JSON.parse(merged.ok ? merged.json : "{}") as { aiConfig: unknown }).aiConfig, tomb);
});

/* ---------- 11. redaction ---------- */

test("errors and logs are scrubbed of every saved key (prefix-less Azure / custom keys included) and token patterns", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  const echo = `bad key ${KEYS_A.azure} / ${KEYS_A.stt} / ${KEYS_A.openai} / ${KEYS_A.gemini} / ${KEYS_A.anthropic}`;
  const err = await errorFrom(new Response(JSON.stringify({ error: { message: echo } }), { status: 401 }), "Azure 语音");
  for (const k of Object.values(KEYS_A)) assert.equal(err.message.includes(k), false, `redacted ${k}`);
  assert.match(err.message, /Key 不对/);
  const custom = await errorFrom(new Response(`upstream said: token myCustomRelayKey_42xyz`, { status: 500 }), "Whisper", "myCustomRelayKey_42xyz");
  assert.equal(custom.message.includes("myCustomRelayKey_42xyz"), false);
  const s = redactSecrets("gsk_abcdefghijklmnop mb2_ABCDEFGHIJKLMNOPQRSTUV mb2a_ABCDEFGHIJKLMNOPQRSTUV Authorization: Bearer abc.def-ghi_jkl123 ?key=zzz");
  assert.equal(s, "gsk_*** mb2_*** mb2a_*** Authorization: Bearer *** ?key=***");

  // a model echoing the key inside a 200 error body
  const fetcher = (async () => json({ error: { code: 500, message: `echo ${KEYS_A.openai}` } })) as typeof fetch;
  await assert.rejects(
    () => openaiJsonWith("deepseek", "deepseek-chat", { system: "s", text: "t", schema: {}, schemaName: "x" }, { apiKey: KEYS_A.openai, fetcher }),
    (e: Error) => !e.message.includes(KEYS_A.openai),
  );
  // short explicit custom keys (1-3 chars) are redacted on word boundaries without mangling prose
  const shortErr = await errorFrom(new Response(`invalid key: "k9x" in request`, { status: 401 }), "OpenAI", "k9x");
  assert.equal(shortErr.message.includes("k9x"), false);
  assert.equal(redactSecrets("token=abc text abstract", "abc"), "token=*** text abstract");

  // the sync engine never surfaces server error bodies or keys in lastError when a push fails
  addCard("bonjour");
  setSyncKeysEnabled(true);
  const code = await registerWithInvite("inv_err_redact");
  assert.ok(code);
  addCard("merci");
  cloud.failSyncPutBody = `leaked ${KEYS_A.openai} and ${KEYS_A.azure}`;
  await syncNow();
  const lastErr = String(getSyncState().lastError ?? "");
  assert.match(lastErr, /上传失败（500）/);
  assert.equal(lastErr.includes(KEYS_A.openai), false);
  assert.equal(lastErr.includes(KEYS_A.azure), false);
});

/* ---------- 12. Tier 3 cross-review regressions ---------- */

test("fresh device with default settings never reveals raw syncCode on 401; upgraded v1 alias is flagged legacyAuth on pair", async () => {
  // 1. Device A uploads encrypted keys; fresh Device B (key sync NOT enabled yet) gets 401 -> raw code is NEVER sent
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_zk_pair");

  const B = newDevice();
  use(B);
  cloud.tokens.clear();
  cloud.tokens.add(code); // malicious server rejects derived mb2a_ to fish for raw code
  cloud.requests = [];
  await assert.rejects(() => pairWithCode(code), SyncAuthError);
  assert.equal(cloud.requests.some((r) => (r.headers.Authorization ?? "").includes(code)), false, "fresh device never leaks raw syncCode on 401");

  // 2. Upgraded v1 account whose mb2a_ alias is accepted by the server is still flagged legacyAuth via /api/auth
  resetCloud();
  const v1UpgradedCode = "mb2_UPGRADEDV1ACCOUNT0123456789abcdefghijklmno";
  const derivedAlias = await deriveSyncAuthToken(v1UpgradedCode);
  cloud.tokens.add(derivedAlias);
  cloud.legacyTokens.add(derivedAlias);
  const C = newDevice();
  use(C);
  setKeys(KEYS_B);
  await pairWithCode(v1UpgradedCode);
  assert.equal(getSyncState().legacyAuth, true, "re-pairing an upgraded v1 alias preserves legacyAuth=true");
  setSyncKeysEnabled(true);
  addCard("salut");
  await syncNow();
  assert.equal(getSyncState().lastError, ZERO_KNOWLEDGE_REQUIRED_FOR_KEYS);
  assert.equal(puts(), 0, "keys are blocked from uploading on an upgraded v1 alias");
});

test("flipping key sync off while pull is in flight strips keys before PUT and tracks exact syncedPolicyRev", async () => {
  const A = newDevice();
  use(A);
  setKeys(KEYS_A);
  configureA();
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_inflight");
  assert.equal((await cloudPlain(code)).ai?.includeKeys, true);

  // Trigger a new syncNow where the learner switches key sync OFF while GET is in flight
  addCard("merci");
  cloud.onSyncGet = () => {
    cloud.onSyncGet = null;
    setSyncKeysEnabled(false);
  };
  await syncNow();
  const latest = await cloudPlain(code);
  assert.equal(latest.ai?.includeKeys, false, "in-flight upload stripped revoked keys before encrypting");
  assert.equal("keys" in (latest.ai ?? {}), false);
  assert.equal(getAiSyncPrefs().syncedPolicyRev, getAiSyncPrefs().policyRev);
  assert.equal(getAiConfig().keys.openai, KEYS_A.openai, "local keys remain intact");
});

test("restoreHistoryVersion refreshes passthroughKeys from latest so rotated or cleared shared keys are not reverted", async () => {
  const A = newDevice();
  use(A);
  setKeys({ ...KEYS_A, openai: "" });
  setSyncKeysEnabled(true);
  addCard("bonjour");
  const code = await registerWithInvite("inv_hist_pt");

  // Device B has its own private openai key (keyPolicy stays unset, passthroughKeys caches gemini=KEYS_A.gemini)
  const B = newDevice();
  use(B);
  setAiConfig((c) => ({ ...c, keys: { ...c.keys, openai: KEYS_B.openai } }));
  await pairWithCode(code);
  assert.equal(getAiSyncPrefs().keyPolicy, "unset");
  assert.equal(getAiSyncPrefs().passthroughKeys?.keys.gemini, KEYS_A.gemini);

  // Device A rotates gemini key and adds a card (creating history snapshot v1 with old gemini key)
  use(A);
  const ROTATED_GEMINI = "AIzaSyA-ROTATED-NEW-KEY-999999999";
  setAiConfig((c) => ({ ...c, keys: { ...c.keys, gemini: ROTATED_GEMINI } }));
  addCard("salut");
  await syncNow();
  assert.equal((await cloudPlain(code)).ai && ((await cloudPlain(code)).ai!.keys as Record<string, string>).gemini, ROTATED_GEMINI);

  // Device B restores learning history v1 without pulling first: passthroughKeys must refresh from latest!
  use(B);
  const histList = await getSyncHistory();
  assert.ok(histList.length >= 1);
  await restoreHistoryVersion(histList[0].id);
  const after = await cloudPlain(code);
  const cloudKeys = (after.ai?.keys ?? {}) as Record<string, string>;
  assert.equal(cloudKeys.gemini, ROTATED_GEMINI, "rotated shared key was NOT overwritten by stale passthroughKeys");
  assert.equal(cloudKeys.openai, "", "B's private openai key was still never uploaded");
});

test("resolveConflict('remote') adopts cloud AI config even when local configRev/policyRev was higher, keeping local keys", async () => {
  const A = newDevice();
  use(A);
  configureA(); // configRev = 1, azureVoice = Vivienne
  addCard("bonjour");
  const code = await registerWithInvite("inv_adopt_remote");
  const putsAfterA = puts();

  // Device B makes multiple local AI edits (configRev = 3) and disables config sync (policyRev = 1) before pairing
  const B = newDevice();
  use(B);
  setKeys(KEYS_B);
  setAiConfig({ azureVoice: "fr-FR-HenriNeural" });
  setAiConfig({ azureRegion: "japaneast" });
  setAiConfig({ tts: false });
  setSyncConfigEnabled(false);
  addCard("local_card");

  const dec = await pairWithCode(code);
  assert.equal(dec, "conflict");
  const ok = await resolveConflict("remote");
  assert.equal(ok, true);
  assert.equal(puts(), putsAfterA, "choosing 仅用云端 adopts cloud AI config cleanly without overwriting cloud");
  assert.equal(getAiConfig().azureVoice, "fr-FR-VivienneMultilingualNeural");
  assert.equal(getAiSyncPrefs().configPolicy, "enabled");
  assert.deepEqual(slotsOf(), KEYS_B, "all 7 local private keys on B remain untouched");
});

test("unpair -> preset toggle before pairing a second account is honoured, and private key edits keep configRev=0", async () => {
  const A = newDevice();
  use(A);
  // Editing private keys (even when lastGoodModel is cleared) never advances configRev while key sync is off
  setAiConfig((c) => ({ ...c, keys: { ...c.keys, openai: KEYS_A.openai }, lastGoodModel: { openai: "gpt-5-mini" } }));
  assert.equal(getAiSyncPrefs().configRev, 1);
  setAiConfig((c) => {
    const nextLast = { ...c.lastGoodModel };
    delete nextLast.openai;
    return { ...c, keys: { ...c.keys, openai: KEYS_B.openai }, lastGoodModel: nextLast };
  });
  assert.equal(getAiSyncPrefs().configRev, 1, "replacing a private key and clearing its lastGoodModel cache does not bump configRev");

  addCard("bonjour");
  await registerWithInvite("inv_first_acct");
  unpairLocal();
  resetCloud();

  // While unpaired, learner turns config sync OFF before registering a second account
  setSyncConfigEnabled(false);
  assert.equal(getAiSyncPrefs().configPolicy, "disabled");
  const code2 = await registerWithInvite("inv_second_acct");
  assert.equal(getAiSyncPrefs().configPolicy, "disabled", "preset chosen while unpaired was NOT wiped by bindAiSyncAccount");
  assert.equal((await cloudPlain(code2)).ai?.enabled, false);
});
