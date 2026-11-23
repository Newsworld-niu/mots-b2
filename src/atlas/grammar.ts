import { useEffect, useState } from "react";
import type { GrammarData, GrammarMeta } from "../lib/grammar";

let cache: Promise<GrammarData> | null = null;
let loadedFull: GrammarData | null = null;
let metaCache: Promise<GrammarMeta> | null = null;

/** Grammar points and drills (public/atlas/grammar.json), loaded once on first use. */
export function loadGrammar(): Promise<GrammarData> {
  if (!cache)
    cache = fetch(`${import.meta.env.BASE_URL}atlas/grammar.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`语法数据加载失败（${r.status}）`);
        return r.json() as Promise<GrammarData>;
      })
      .then((d) => {
        loadedFull = d;
        return d;
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  return cache;
}

/** Lightweight metadata for all grammar points (< 20 KB), used by Today without fetching full grammar.json. */
export function loadGrammarMeta(): Promise<GrammarMeta> {
  if (loadedFull) return Promise.resolve(loadedFull);
  if (!metaCache)
    metaCache = fetch(`${import.meta.env.BASE_URL}atlas/grammar-meta.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`语法目录加载失败（${r.status}）`);
        return r.json() as Promise<GrammarMeta>;
      })
      .catch((e) => {
        metaCache = null;
        throw e;
      });
  return metaCache;
}

export function useGrammar() {
  const [data, setData] = useState<GrammarData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadGrammar().then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  return { data, error };
}

export function useGrammarMeta() {
  const [data, setData] = useState<GrammarMeta | null>(loadedFull);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadGrammarMeta().then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  return { data, error };
}
