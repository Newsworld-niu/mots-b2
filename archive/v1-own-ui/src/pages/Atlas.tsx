import { Search } from "lucide-react";
import { useMemo } from "react";
import { TOPICS, WORD_ORDER, topicOf, zhOf, type TopicKey } from "../data";
import { fold } from "../lib/fr";
import { go, setParams, useRoute } from "../lib/router";
import { isMastered } from "../store/srs";
import { useStore } from "../store/store";
import { Art } from "../ui/Art";

export function Atlas() {
  const { params } = useRoute();
  const topic = params.get("topic") as TopicKey | null;
  const q = params.get("q") ?? "";
  const cards = useStore((s) => s.progress.cards);
  const bookmarks = useStore((s) => s.progress.bookmarks);
  const onlyMarked = params.get("saved") === "1";

  const list = useMemo(() => {
    const needle = fold(q.trim());
    return WORD_ORDER.filter((w) => {
      if (topic && w.topic !== topic) return false;
      if (onlyMarked && !bookmarks.includes(w.id)) return false;
      if (!needle) return true;
      return fold(w.w).includes(needle) || fold(zhOf(w)).includes(needle) || w.senses.some((s) => fold(s.zh).includes(needle));
    });
  }, [topic, q, onlyMarked, bookmarks]);

  return (
    <div className="page atlas">
      <header className="page-head">
        <p className="eyebrow">Mots B2 · 词图</p>
        <h1 className="display">{topic ? topicOf(topic).zh : "法语 B2 词图"}</h1>
        <p className="lede">
          {WORD_ORDER.length} 个 B2 词条 · 原创例句 · 法语朗读 · 间隔复习。点击任一词卡查看释义、搭配与用法提示。
        </p>
      </header>

      <div className="atlas-tools">
        <label className="search-box">
          <Search size={17} />
          <input
            type="search"
            placeholder="输入法语词或中文释义"
            value={q}
            onChange={(e) => setParams({ q: e.target.value || null })}
            aria-label="搜索词条"
          />
        </label>
        <div className="chips" role="group" aria-label="按主题筛选">
          <button className={`chip-btn ${!topic ? "is-on" : ""}`} onClick={() => setParams({ topic: null })}>
            全部
          </button>
          {TOPICS.map((t) => (
            <button key={t.key} className={`chip-btn ${topic === t.key ? "is-on" : ""}`} onClick={() => setParams({ topic: t.key })}>
              {t.zh}
            </button>
          ))}
          <button className={`chip-btn ${onlyMarked ? "is-on" : ""}`} onClick={() => setParams({ saved: onlyMarked ? null : "1" })}>
            我的收藏
          </button>
        </div>
      </div>

      <p className="result-count">{list.length} 个词条</p>
      {list.length === 0 ? (
        <p className="empty">没有匹配的词条。换个关键词，或点击“全部”。</p>
      ) : (
        <ul className="grid">
          {list.map((w) => {
            const c = cards[w.id];
            const t = topicOf(w.topic as TopicKey);
            return (
              <li key={w.id}>
                <button className="word-card" onClick={() => setParams({ word: w.id })}>
                  <Art topic={w.topic as TopicKey} tone={t.tone} word={w.w} className="card-art" />
                  <span className="word-card-body">
                    <span className="word-card-top">
                      <b lang="fr">{w.w}</b>
                      {c && <i className={isMastered(c) ? "dot is-done" : "dot is-on"} aria-label={isMastered(c) ? "已掌握" : "学习中"} />}
                    </span>
                    <span className="word-card-zh">{zhOf(w)}</span>
                    <small>{t.zh}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {topic && <p className="back-link"><button className="link" onClick={() => go("atlas")}>查看全部主题</button></p>}
    </div>
  );
}
