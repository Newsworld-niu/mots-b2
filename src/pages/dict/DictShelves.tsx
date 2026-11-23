import { Bookmark, ExternalLink, History, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { frdicUrl } from "../../lib/frdic";
import { loadSuggestShard, suggestBucket } from "../../lib/lexdb/load";
import { type ZhHit } from "../../lib/lexdb/search";
import { clearDictHistory, toggleDictFav, useDictStore } from "../../lib/lexdb/store";
import { lexdbFold, type LexMeta, type LexSuggestRow } from "../../lib/lexdb/types";
import { isNative } from "../../lib/native";
import { href } from "../../lib/router";
import { wiktionaryLinks } from "../../lib/wiktionary";
import { toast } from "../../ui/Toast";

export function ZhResults({ query, hits }: { query: string; hits: ZhHit[] }) {
  return (
    <section className="dict-empty-card">
      <div>
        <p className="eyebrow">中文反查</p>
        <h2>「{query}」的法语匹配（{hits.length} 条）</h2>
      </div>
      {hits.length === 0 ? (
        <p className="muted">没有找到包含「{query}」的法语词条，可以换个近义词或在词图中搜索。</p>
      ) : (
        <ul className="dict-zh-list">
          {hits.map((h) => (
            <li key={h.id}>
              <a className="dict-zh-row" href={href({ page: "dict", w: h.w ?? h.id })}>
                <b className="dict-zh-word" lang="fr">
                  {h.w ?? h.id}
                </b>
                <span className="dict-zh-gloss">{h.shortZh || h.term}</span>
                {h.rank < 99999 && <span className="src-pill">#{h.rank}</span>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function NotFoundCard({ query, didYouMeanRows }: { query: string; didYouMeanRows: LexSuggestRow[] }) {
  const wikt = wiktionaryLinks(query);
  return (
    <section className="dict-empty-card">
      <div>
        <p className="eyebrow">未找到词条</p>
        <h2>
          词典里没有「<span lang="fr">{query}</span>」
        </h2>
      </div>

      {didYouMeanRows.length > 0 && (
        <div>
          <p className="muted small dict-dym-label">
            你是不是要找…
          </p>
          <div className="dict-dym-list">
            {didYouMeanRows.map((row) => (
              <a key={`${row[0]}-${row[1]}`} className="dict-dym-chip" href={href({ page: "dict", w: row[1] })}>
                <b lang="fr">{row[1]}</b>
                {row[3] && <small>{row[3]}</small>}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="dict-actions-row">
        <a
          className="btn btn-ghost btn-sm"
          href={frdicUrl(query)}
          target={isNative() ? "_self" : "_blank"}
          rel="noopener noreferrer"
        >
          去法语助手原文查看 <ExternalLink size={13} />
        </a>
        {wikt && (
          <a
            className="btn btn-ghost btn-sm"
            href={wikt.search}
            target={isNative() ? "_self" : "_blank"}
            rel="noopener noreferrer"
          >
            Wiktionnaire 搜索 <ExternalLink size={13} />
          </a>
        )}
      </div>
    </section>
  );
}

export function HistoryFavShelf({
  suggestMap,
  meta,
  onLoadedRows,
  compact = false,
}: {
  suggestMap: Map<string, LexSuggestRow>;
  meta?: LexMeta | null;
  onLoadedRows: (rows: LexSuggestRow[]) => void;
  compact?: boolean;
}) {
  const { history, favs } = useDictStore();
  const [shelfTab, setShelfTab] = useState<"history" | "favs">("history");
  const ids = shelfTab === "history" ? history : favs;
  const visibleIds = useMemo(() => ids.slice(0, compact ? 15 : 40), [ids, compact]);
  const fetchedBucketsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    fetchedBucketsRef.current.clear();
  }, [meta]);

  useEffect(() => {
    if (!meta?.suggestShards || !visibleIds.length) return;
    const buckets = new Set<string>();
    for (const id of visibleIds) {
      const clean = id.replace(/#\d+$/, "");
      if (!suggestMap.has(id) && !suggestMap.has(clean)) {
        const b = suggestBucket(lexdbFold(clean), meta.suggestSplits);
        if (!fetchedBucketsRef.current.has(b)) buckets.add(b);
      }
    }
    if (!buckets.size) return;
    let alive = true;
    for (const b of buckets) fetchedBucketsRef.current.add(b);
    void Promise.all([...buckets].map((b) => loadSuggestShard(b))).then((chunks) => {
      if (!alive) return;
      const flat = chunks.flatMap((c) => c ?? []);
      if (flat.length) onLoadedRows(flat);
    });
    return () => {
      alive = false;
    };
  }, [visibleIds, meta, suggestMap, onLoadedRows]);

  const displayRow = (id: string) => {
    const clean = id.replace(/#\d+$/, "");
    const row = suggestMap.get(id) ?? suggestMap.get(clean);
    return { w: row?.[1] ?? clean, zh: row?.[3] ?? "" };
  };

  return (
    <section className="dict-shelf" aria-label="最近查词与收藏夹">
      <div className="dict-shelf-head">
        <div className="segmented" role="tablist" aria-label="查词记录与收藏">
          <button
            type="button"
            role="tab"
            aria-selected={shelfTab === "history"}
            className={shelfTab === "history" ? "is-on" : ""}
            onClick={() => setShelfTab("history")}
          >
            <History size={13} className="dict-shelf-ico" />
            最近查词{history.length ? ` (${history.length})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={shelfTab === "favs"}
            className={shelfTab === "favs" ? "is-on" : ""}
            onClick={() => setShelfTab("favs")}
          >
            <Bookmark size={13} className="dict-shelf-ico" />
            收藏夹{favs.length ? ` (${favs.length})` : ""}
          </button>
        </div>

        {shelfTab === "history" && history.length > 0 && (
          <button
            type="button"
            className="link small"
            onClick={() => {
              clearDictHistory();
              toast("已清空最近查词记录");
            }}
          >
            清空
          </button>
        )}
      </div>

      {ids.length === 0 ? (
        <p className="muted small">
          {shelfTab === "history" ? "还没有查词记录，查过的词会自动记在这里。" : "还没有收藏词典词条，点词头的「收藏」即可保存。"}
        </p>
      ) : (
        <ul className="dict-shelf-list">
          {ids.slice(0, compact ? 15 : 40).map((id) => {
            const info = displayRow(id);
            const targetW = id.includes("#") ? id : info.w;
            return (
              <li key={id} className="dict-shelf-row">
                <a className="dict-shelf-link" href={href({ page: "dict", w: targetW })}>
                  <b lang="fr">{info.w}</b>
                  {info.zh && <span>{info.zh}</span>}
                </a>
                {shelfTab === "favs" && (
                  <button
                    type="button"
                    className="icon-btn is-xs"
                    aria-label={`取消收藏 ${info.w}`}
                    onClick={() => toggleDictFav(id)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
