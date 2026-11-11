import { useEffect, useState } from "react";
import type { GrammarData } from "../lib/grammar";

let cache: Promise<GrammarData> | null = null;

/** Grammar points and drills (public/atlas/grammar.json), loaded once on first use. */
export function loadGrammar(): Promise<GrammarData> {
  if (!cache)
    cache = fetch(`${import.meta.env.BASE_URL}atlas/grammar.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`语法数据加载失败（${r.status}）`);
        return r.json() as Promise<GrammarData>;
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  return cache;
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
