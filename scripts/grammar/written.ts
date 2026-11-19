/* Hand-written grammar content: parsing and checks shared by scripts/build-grammar.ts and
 * scripts/grammar/check-gen.ts.
 *
 * Written drill formats (data/grammar/drills.json, data/grammar/gen/<point>.json):
 *
 *   choice     { "s": "Bien qu'il [soit] malade, …", "x": [["est", "why est is wrong"], …], "y", "z", "h"?, "g"? }
 *              (x may also hold bare strings: old drills without explanations)
 *   type       { "k": "t", "s": "… [viennes] …", "a"?: ["other accepted answers"], "h", "y", "z", "g"? }
 *   fix        { "k": "f", "s": "… {sont parti} …", "r": ["sont partis"] | [], "y", "z", "g"? }
 *              (r empty = the underlined part is right)
 *   transform  { "k": "x", "q": "sentence given", "h": "instruction", "a": ["reference answer", "other accepted"], "y", "z", "g"? }
 *
 * "g" is what the drill trains: "r<i>" the point's rule i, "t<i>" its trap i (0-based).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Drill } from "../../src/lib/grammar.ts";

const ROOT = resolve(import.meta.dirname, "../..");

export interface WrittenChoice {
  k?: "c";
  s: string;
  x: (string | [string, string])[];
  y: string;
  z: string;
  h?: string;
  g?: string;
}
export interface WrittenType {
  k: "t";
  s: string;
  a?: string[];
  h: string;
  y: string;
  z: string;
  g?: string;
}
export interface WrittenFix {
  k: "f";
  s: string;
  r: string[];
  y: string;
  z: string;
  h?: string;
  g?: string;
}
export interface WrittenTransform {
  k: "x";
  q: string;
  h: string;
  a: string[];
  y: string;
  z: string;
  g?: string;
}
export type Written = WrittenChoice | WrittenType | WrittenFix | WrittenTransform;

/** Points whose drills ask for the verb form itself: another person of the verb is a fair distractor there. */
export const PERSON_IS_THE_POINT = new Set(["present", "imparfait", "futur", "imperatif", "passe-simple"]);

/* ---------- verb forms (for the person check) ---------- */

let formIndex: Map<string, { v: string; p: number }[]> | null = null;
function forms() {
  if (formIndex) return formIndex;
  formIndex = new Map();
  const verbs: Record<string, { f: Record<string, string[]> }> = JSON.parse(readFileSync(resolve(ROOT, "public/atlas/conj.json"), "utf8")).verbs;
  for (const [v, verb] of Object.entries(verbs))
    for (const list of Object.values(verb.f))
      list.forEach((f, p) => {
        if (!f) return;
        const k = f.toLowerCase();
        formIndex!.set(k, [...(formIndex!.get(k) ?? []), { v, p }]);
      });
  return formIndex;
}
const words = (s: string) => s.toLowerCase().replace(/’/g, "'").split(/[\s']+/).filter(Boolean);

/**
 * A distractor that is the same verb in another person: it can be ruled out by the subject alone, without
 * knowing the point (Je ne pense pas qu'il [ait] … with « aie » as an option). Returns the clashing words.
 */
export function personLeak(answer: string, wrong: string): string | null {
  const a = words(answer);
  const x = words(wrong);
  if (a.length !== x.length) return null;
  const idx = forms();
  for (let i = 0; i < a.length; i++) {
    if (a[i] === x[i]) continue;
    const fa = idx.get(a[i]);
    const fx = idx.get(x[i]);
    if (!fa || !fx) continue;
    const shared = new Set(fa.map((f) => f.v).filter((v) => fx.some((g) => g.v === v)));
    if (!shared.size) continue;
    const pa = new Set(fa.filter((f) => shared.has(f.v)).map((f) => f.p));
    const px = fx.filter((f) => shared.has(f.v)).map((f) => f.p);
    if (!px.some((p) => pa.has(p))) return `${a[i]} / ${x[i]}`;
  }
  return null;
}

/* ---------- parsing ---------- */

export interface Problem {
  point: string;
  at: string;
  msg: string;
}

const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;
const TAG = /^[rt]\d+$/;

/**
 * Turn the written drills of a point into built drills. Problems are collected rather than thrown, so a
 * checker can list them all; the build throws on any.
 */
export function parseWritten(point: string, list: unknown[], counts: { rules: number; traps: number }, problems: Problem[]): Drill[] {
  const out: Drill[] = [];
  list.forEach((raw, n) => {
    const at = `#${n + 1}`;
    const r = raw as { s?: unknown; q?: unknown } | null;
    const label = typeof r?.s === "string" ? r.s : typeof r?.q === "string" ? r.q : "";
    const bad = (msg: string) => problems.push({ point, at: `${at} ${label}`.slice(0, 120), msg });
    if (!raw || typeof raw !== "object") return bad("not an object");
    const w = raw as Written;
    if (!str(w.z) || !str(w.y)) return bad("z and y are required");
    if (w.g !== undefined) {
      if (typeof w.g !== "string" || !TAG.test(w.g)) return bad(`bad tag ${w.g}`);
      const i = Number(w.g.slice(1));
      if (w.g[0] === "r" ? i >= counts.rules : i >= counts.traps) return bad(`tag ${w.g} out of range (${counts.rules} rules, ${counts.traps} traps)`);
    }
    const g = w.g ? { g: w.g } : {};
    const kind = w.k ?? "c";
    if (kind === "c" || kind === "t") {
      const ww = w as WrittenChoice | WrittenType;
      const m = typeof ww.s === "string" ? /^([^[\]]*)\[([^[\]]+)\]([^[\]]*)$/.exec(ww.s) : null;
      if (!m) return bad("s needs exactly one [answer]");
      const [, before, answer, after] = m;
      const s = before + answer + after;
      const b: [number, number] = [before.length, before.length + answer.length];
      if (kind === "t") {
        const t = ww as WrittenType;
        if (!str(t.h)) return bad("a typed drill needs a hint (h)");
        const alts = Array.isArray(t.a) ? t.a.filter(str) : [];
        out.push({ k: "t", s, z: w.z, b, a: [answer, ...alts.filter((x) => x !== answer)], h: t.h, y: w.y, ...g });
        return;
      }
      const c = ww as WrittenChoice;
      if (!Array.isArray(c.x) || !c.x.length) return bad("x (distractors) is required");
      const opts: string[] = [];
      const e: Record<string, string> = {};
      for (const x of c.x) {
        const [form, why] = typeof x === "string" ? [x, ""] : Array.isArray(x) ? [x[0], x[1]] : ["", ""];
        if (!str(form)) return bad("empty distractor");
        opts.push(form);
        if (str(why)) e[form] = why.trim();
      }
      const all = [answer, ...opts];
      if (new Set(all.map((o) => o.toLowerCase().trim())).size !== all.length) return bad("an option repeats (or equals the answer)");
      if (!PERSON_IS_THE_POINT.has(point))
        for (const o of opts) {
          const leak = personLeak(answer, o);
          if (leak) bad(`distractor « ${o} » is another person of the same verb (${leak}): the subject alone rules it out`);
        }
      out.push({ k: "c", s, z: w.z, b, o: all, h: c.h ?? "", y: w.y, ...(Object.keys(e).length ? { e } : {}), ...g });
      return;
    }
    if (kind === "f") {
      const f = w as WrittenFix;
      const m = typeof f.s === "string" ? /^([^{}]*)\{([^{}]+)\}([^{}]*)$/.exec(f.s) : null;
      if (!m) return bad("s needs exactly one {underlined part}");
      if (!Array.isArray(f.r) || f.r.some((x) => !str(x))) return bad("r must be a list of corrections ([] when right)");
      const [, before, seg, after] = m;
      if (f.r.some((x) => x.trim() === seg.trim())) return bad("a correction equals the underlined part");
      out.push({ k: "f", s: before + seg + after, z: w.z, b: [before.length, before.length + seg.length], r: f.r, h: f.h ?? "", y: w.y, ...g });
      return;
    }
    if (kind === "x") {
      const x = w as WrittenTransform;
      if (!str(x.q) || !str(x.h) || !Array.isArray(x.a) || !x.a.length || x.a.some((a) => !str(a))) return bad("a transform needs q, h and a");
      out.push({ k: "x", q: x.q, s: x.a[0], z: w.z, a: x.a, h: x.h, y: w.y, ...g });
      return;
    }
    bad(`unknown kind ${String(kind)}`);
  });
  return out;
}
