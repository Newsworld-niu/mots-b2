import { useEffect, useState } from "react";
import type { CfData } from "../lib/confusables";

let cache: Promise<CfData> | null = null;

/** Confusable-word groups (public/atlas/confusables.json, a few tens of kB), loaded once on first use. */
export function loadConfusables(): Promise<CfData> {
  if (!cache)
    cache = fetch(`${import.meta.env.BASE_URL}atlas/confusables.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`易混词数据加载失败（${r.status}）`);
        return r.json() as Promise<CfData>;
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  return cache;
}

export function useConfusables() {
  const [data, setData] = useState<CfData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    loadConfusables().then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  return { data, error };
}
