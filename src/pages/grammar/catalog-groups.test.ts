import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  defaultGroupOpen,
  formatGroupPreview,
  GRAMMAR_GROUPS_KEY,
  isCatalogGroupOpen,
  mergeGroupOpenOverrides,
  readGroupOpenOverrides,
  sanitizeGroupOpenOverrides,
  writeGroupOpenOverrides,
  type GroupOpenOverrides,
} from "./catalog-groups";

/** A minimal in-memory localStorage for node. */
class MemoryStorage {
  private m = new Map<string, string>();
  throwOnSet = false;
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.throwOnSet) throw new Error("QuotaExceededError");
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const g = globalThis as { localStorage?: unknown };
let saved: unknown;
let mem: MemoryStorage;

beforeEach(() => {
  saved = g.localStorage;
  mem = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: mem, configurable: true, writable: true });
});

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: saved, configurable: true, writable: true });
});

test("defaultGroupOpen: level and category groups start collapsed", () => {
  for (const lv of ["A1", "A2", "B1", "B2"]) assert.equal(defaultGroupOpen("level", lv, "B1"), false);
  for (const c of ["tense", "pronoun", "other"]) assert.equal(defaultGroupOpen("category", c, "tense"), false);
});

test("defaultGroupOpen: todo opens due, weak only when it leads, never new", () => {
  assert.equal(defaultGroupOpen("todo", "due", "due"), true);
  assert.equal(defaultGroupOpen("todo", "weak", "due"), false);
  assert.equal(defaultGroupOpen("todo", "weak", "weak"), true);
  assert.equal(defaultGroupOpen("todo", "new", "due"), false);
  assert.equal(defaultGroupOpen("todo", "new", "new"), false);
  assert.equal(defaultGroupOpen("todo", "new"), false);
});

test("read/write overrides round-trip", () => {
  const o: GroupOpenOverrides = { level: { A2: true, B1: false }, todo: { new: true } };
  writeGroupOpenOverrides(o);
  assert.deepEqual(readGroupOpenOverrides(), o);
  assert.deepEqual(JSON.parse(mem.getItem(GRAMMAR_GROUPS_KEY)!), o);
});

test("readGroupOpenOverrides survives missing storage, malformed JSON and non-objects", () => {
  assert.deepEqual(readGroupOpenOverrides(), {});
  mem.setItem(GRAMMAR_GROUPS_KEY, "{not json");
  assert.deepEqual(readGroupOpenOverrides(), {});
  mem.setItem(GRAMMAR_GROUPS_KEY, "[1,2]");
  assert.deepEqual(readGroupOpenOverrides(), {});
  mem.setItem(GRAMMAR_GROUPS_KEY, "null");
  assert.deepEqual(readGroupOpenOverrides(), {});
  Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true, writable: true });
  assert.deepEqual(readGroupOpenOverrides(), {});
  assert.doesNotThrow(() => writeGroupOpenOverrides({ level: { A1: true } }));
});

test("writeGroupOpenOverrides swallows quota errors", () => {
  mem.throwOnSet = true;
  assert.doesNotThrow(() => writeGroupOpenOverrides({ level: { A1: true } }));
});

test("sanitize drops non-boolean values, unknown views and caps keys per view", () => {
  mem.setItem(
    GRAMMAR_GROUPS_KEY,
    JSON.stringify({ level: { A1: true, A2: "yes", B1: 1, B2: false }, category: [true], todo: null, bogus: { x: true } }),
  );
  assert.deepEqual(readGroupOpenOverrides(), { level: { A1: true, B2: false } });

  const many = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, true]));
  const clean = sanitizeGroupOpenOverrides({ category: many, level: { ...many, A2: true } });
  assert.equal(Object.keys(clean.category ?? {}).length, 32);
  // known keys are never crowded out by obsolete unknown keys
  assert.equal(clean.level?.A2, true);
});

test("sanitize rejects Object.prototype keys and accepts null-prototype objects", () => {
  mem.setItem(GRAMMAR_GROUPS_KEY, '{"level":{"__proto__":true,"constructor":true,"toString":true,"A2":true}}');
  const parsed = readGroupOpenOverrides();
  assert.deepEqual(parsed, { level: { A2: true } });

  const nullProto = Object.assign(Object.create(null), {
    level: Object.assign(Object.create(null), { A1: true }),
  });
  assert.deepEqual(sanitizeGroupOpenOverrides(nullProto), { level: { A1: true } });

  // inherited keys never masquerade as booleans in isCatalogGroupOpen
  assert.equal(
    isCatalogGroupOpen({ view: "level", groupKey: "toString", isSearching: false, overrides: { level: {} } }),
    false,
  );
  assert.equal(
    isCatalogGroupOpen({ view: "level", groupKey: "toString", isSearching: true, overrides: {}, searchOverrides: {} }),
    true,
  );
});

test("mergeGroupOpenOverrides preserves another tab's saved choices", () => {
  // Tab 1 saved A2: true in storage after Tab 2 mounted with empty state
  writeGroupOpenOverrides({ level: { A2: true }, todo: { new: false } });
  const tab2Next = mergeGroupOpenOverrides({}, "level", { B1: true });
  assert.deepEqual(tab2Next, { level: { A2: true, B1: true }, todo: { new: false } });
  assert.deepEqual(readGroupOpenOverrides(), { level: { A2: true, B1: true }, todo: { new: false } });
});

test("customizing only `new` keeps a future `due` group auto-open", () => {
  writeGroupOpenOverrides({ todo: { new: false } });
  const overrides = readGroupOpenOverrides();
  assert.equal(isCatalogGroupOpen({ view: "todo", groupKey: "due", firstGroupKey: "due", isSearching: false, overrides }), true);
  assert.equal(isCatalogGroupOpen({ view: "todo", groupKey: "new", firstGroupKey: "due", isSearching: false, overrides }), false);
});

test("isCatalogGroupOpen: overrides win over defaults outside search", () => {
  const overrides: GroupOpenOverrides = { level: { A2: true }, todo: { due: false } };
  const base = { firstGroupKey: "B1", isSearching: false, overrides };
  assert.equal(isCatalogGroupOpen({ ...base, view: "level", groupKey: "A2" }), true);
  assert.equal(isCatalogGroupOpen({ ...base, view: "level", groupKey: "B1" }), false);
  assert.equal(isCatalogGroupOpen({ ...base, view: "todo", groupKey: "due", firstGroupKey: "due" }), false);
  // a view's overrides do not leak into another view
  assert.equal(isCatalogGroupOpen({ ...base, view: "category", groupKey: "A2" }), false);
});

test("isCatalogGroupOpen: search opens every group, respects search toggles, leaves overrides untouched", () => {
  const overrides: GroupOpenOverrides = { level: { A2: true } };
  const snapshot = JSON.stringify(overrides);
  const search = { view: "level" as const, isSearching: true, overrides };
  assert.equal(isCatalogGroupOpen({ ...search, groupKey: "B1" }), true);
  assert.equal(isCatalogGroupOpen({ ...search, groupKey: "A2", searchOverrides: { A2: false } }), false);
  assert.equal(isCatalogGroupOpen({ ...search, groupKey: "B1", searchOverrides: { A2: false } }), true);
  // search ends: the saved state comes back as it was
  assert.equal(isCatalogGroupOpen({ ...search, isSearching: false, groupKey: "A2", searchOverrides: { A2: false } }), true);
  assert.equal(isCatalogGroupOpen({ ...search, isSearching: false, groupKey: "B1", searchOverrides: { B1: true } }), false);
  assert.equal(JSON.stringify(overrides), snapshot);
});

test("formatGroupPreview", () => {
  assert.equal(formatGroupPreview([]), "");
  assert.equal(formatGroupPreview([{ title: "A" }], 0), "");
  assert.equal(formatGroupPreview([{ title: "冠词" }]), "冠词");
  assert.equal(formatGroupPreview([{ title: "{v:être} 与助动词" }]), "être 与助动词");
  assert.equal(formatGroupPreview([{ title: "A" }, { title: "B" }, { title: "C" }]), "A · B · C");
  assert.equal(formatGroupPreview([{ title: "A" }, { title: "B" }, { title: "C" }, { title: "D" }]), "A · B · C …");
  assert.equal(formatGroupPreview([{ title: "A" }, { title: "B" }], 1), "A …");
});
