/**
 * Open/closed state of the grammar catalog's groups (分组伸缩栏): pure defaults, effective-open resolution,
 * a one-line preview of a group's titles, and per-view overrides kept in localStorage.
 */
import { GRAMMAR_CATEGORIES, stripGrammarMarks } from "../../lib/grammar";
import { LEVELS } from "./helpers";

export type CatalogView = "level" | "category" | "todo";

export const GRAMMAR_GROUPS_KEY = "fb2.gram.groups.v1";

/**
 * Explicit per-group choices of the learner, by view. A missing key falls back to `defaultGroupOpen`, so a
 * group that appears later (e.g. a first 该复习了 group) still opens by default.
 */
export type GroupOpenOverrides = Partial<Record<CatalogView, Record<string, boolean>>>;

const VIEWS: readonly CatalogView[] = ["level", "category", "todo"];
const MAX_KEYS_PER_VIEW = 32;
const MAX_KEY_LENGTH = 64;

const KNOWN_KEYS: Record<CatalogView, ReadonlySet<string>> = {
  level: new Set<string>(LEVELS),
  category: new Set<string>([...GRAMMAR_CATEGORIES, "other"]),
  todo: new Set<string>(["due", "weak", "new"]),
};

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isValidGroupKey = (k: string): boolean =>
  Boolean(k) && k.length <= MAX_KEY_LENGTH && !FORBIDDEN_KEYS.has(k) && !(k in Object.prototype);

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** Keep only boolean values on sane own keys, prioritizing known group keys before capping at 32 per view. */
export function sanitizeGroupOpenOverrides(raw: unknown): GroupOpenOverrides {
  if (!isPlainObject(raw)) return {};
  const out: GroupOpenOverrides = {};
  for (const view of VIEWS) {
    if (!Object.hasOwn(raw, view)) continue;
    const m = raw[view];
    if (!isPlainObject(m)) continue;
    const known = KNOWN_KEYS[view];
    const entries = Object.entries(m)
      .filter(([k, v]) => typeof v === "boolean" && isValidGroupKey(k))
      .sort(([a], [b]) => Number(known.has(b)) - Number(known.has(a)));
    const clean: Record<string, boolean> = {};
    let n = 0;
    for (const [k, v] of entries) {
      if (n >= MAX_KEYS_PER_VIEW) break;
      clean[k] = v as boolean;
      n++;
    }
    if (n) out[view] = clean;
  }
  return out;
}

export function readGroupOpenOverrides(): GroupOpenOverrides {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(GRAMMAR_GROUPS_KEY);
    if (!raw) return {};
    return sanitizeGroupOpenOverrides(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeGroupOpenOverrides(overrides: GroupOpenOverrides): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(GRAMMAR_GROUPS_KEY, JSON.stringify(sanitizeGroupOpenOverrides(overrides)));
  } catch {
    /* ignore quota or private mode storage errors */
  }
}

/**
 * Merge a patch for one view against both in-memory state and the latest stored overrides (so two open tabs
 * never clobber each other's saved group choices), persist, and return the sanitized result.
 */
export function mergeGroupOpenOverrides(
  current: GroupOpenOverrides,
  view: CatalogView,
  patch: Record<string, boolean>,
): GroupOpenOverrides {
  const stored = readGroupOpenOverrides();
  const merged: GroupOpenOverrides = { ...current, ...stored };
  for (const v of VIEWS) {
    if (current[v] || stored[v]) {
      merged[v] = { ...(current[v] ?? {}), ...(stored[v] ?? {}) };
    }
  }
  merged[view] = { ...(merged[view] ?? {}), ...patch };
  const next = sanitizeGroupOpenOverrides(merged);
  writeGroupOpenOverrides(next);
  return next;
}

const readOwnBool = (map: Record<string, boolean> | undefined, key: string): boolean | undefined => {
  if (!map || !Object.hasOwn(map, key)) return undefined;
  const v = map[key];
  return typeof v === "boolean" ? v : undefined;
};

/**
 * How a group starts when the learner has not chosen: level and category groups are compact summary cards;
 * in 待复习, 该复习了 opens, 还没掌握 opens when it leads, 还没开始 stays closed.
 */
export function defaultGroupOpen(view: CatalogView, groupKey: string, firstGroupKey?: string): boolean {
  if (view === "todo") return groupKey === "due" || (groupKey === "weak" && firstGroupKey === "weak");
  return false;
}

/** Whether a group is open: while searching every matching group opens unless closed during this search. */
export function isCatalogGroupOpen(opts: {
  view: CatalogView;
  groupKey: string;
  firstGroupKey?: string;
  isSearching: boolean;
  overrides: GroupOpenOverrides;
  searchOverrides?: Record<string, boolean>;
}): boolean {
  const { view, groupKey, firstGroupKey, isSearching, overrides, searchOverrides } = opts;
  if (isSearching) return readOwnBool(searchOverrides, groupKey) ?? true;
  const viewMap = Object.hasOwn(overrides, view) ? overrides[view] : undefined;
  return readOwnBool(viewMap, groupKey) ?? defaultGroupOpen(view, groupKey, firstGroupKey);
}

/** The first titles of a group on one line: "A · B · C …". */
export function formatGroupPreview(points: readonly { title: string }[], max = 3): string {
  if (!points.length || max <= 0) return "";
  const head = points
    .slice(0, max)
    .map((p) => stripGrammarMarks(p.title))
    .join(" · ");
  return points.length > max ? `${head} …` : head;
}
