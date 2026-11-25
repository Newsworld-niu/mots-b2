import { useEffect, useState } from "react";
import type { ConjVerb } from "../lib/conjugation";

export interface ConjData {
  v: 1;
  /** verb id → table (only verbs whose generated forms agree with Lexique) */
  verbs: Record<string, ConjVerb>;
}

let cache: Promise<ConjData> | null = null;
const BASE = typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/";

/** Tests: serve this data instead of fetching (null forgets it, so the next use fetches again). */
export function setConjForTest(data: ConjData | null): void {
  cache = data ? Promise.resolve(data) : null;
}

/** Conjugation tables (public/atlas/conj.json, ~90 kB gzipped), loaded once on first use. */
export function loadConj(): Promise<ConjData> {
  if (!cache)
    cache = fetch(`${BASE}atlas/conj.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`变位数据加载失败（${r.status}）`);
        return r.json() as Promise<ConjData>;
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  return cache;
}

export function useConj() {
  const [data, setData] = useState<ConjData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadConj().then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  return { data, error };
}
