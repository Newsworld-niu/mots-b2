import { Bookmark, BookmarkCheck, Lightbulb } from "lucide-react";
import { WORD_INDEX, WORD_ORDER, topicOf, type WordEntry, type TopicKey } from "../data";
import { clozeOf, splitPair } from "../lib/fr";
import { openWord } from "../lib/router";
import { formatInterval, isMastered } from "../store/srs";
import { toggleBookmark, useStore } from "../store/store";
import { Art } from "./Art";
import { Speak } from "./Speak";

export function Highlight({ text, word }: { text: string; word: string }) {
  const c = clozeOf(text, word);
  if (!c) return <>{text}</>;
  return (
    <>
      {c.before}
      <mark>{c.answer}</mark>
      {c.after}
    </>
  );
}

export function EntryView({ entry, mode = "detail" }: { entry: WordEntry; mode?: "detail" | "intro" }) {
  const saved = useStore((s) => s.progress.bookmarks.includes(entry.id));
  const card = useStore((s) => s.progress.cards[entry.id]);
  const topic = topicOf(entry.topic as TopicKey);
  const idx = WORD_INDEX.get(entry.id) ?? 0;
  const status = card ? (isMastered(card) ? "已掌握" : "学习中") : null;
  const famLinks = entry.fam.map((f) => {
    const base = f.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
    const hit = WORD_ORDER.find((x) => x.w.toLowerCase() === base);
    return { label: f, id: hit?.id };
  });
  const pos = entry.senses[0].pos;
  const gender = pos.includes("m.") && !pos.includes("f.") ? "m" : pos.includes("f.") && !pos.includes("m.") ? "f" : "";

  return (
    <article className={`entry entry-${mode}`}>
      <div className="entry-art">
        <Art topic={entry.topic as TopicKey} tone={topic.tone} word={entry.w} className="art-lg" />
      </div>
      <div className="entry-body">
        <header className="entry-head">
          <div className="entry-tags">
            <span className="chip chip-level">B2</span>
            <span className="chip">{topic.zh}</span>
            {status && <span className={`chip chip-status ${status === "已掌握" ? "is-done" : ""}`}>{status}</span>}
          </div>
          {mode === "detail" && (
            <button className={`icon-btn ${saved ? "is-on" : ""}`} onClick={() => toggleBookmark(entry.id)} aria-pressed={saved} aria-label={saved ? "取消收藏" : "收藏"} title={saved ? "取消收藏" : "收藏"}>
              {saved ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}
            </button>
          )}
        </header>
        <p className="specimen">
          № {String(idx + 1).padStart(3, "0")}
          <i />
          Mots B2
        </p>
        <h2 className="headword" lang="fr">
          {entry.w}
          {gender && <small className="gender">{gender === "m" ? "m." : "f."}</small>}
        </h2>
        <div className="pron">
          <Speak text={entry.w} label="écouter" />
          <span className="pos-line">{[...new Set(entry.senses.map((s) => s.pos))].join(" · ")}</span>
        </div>

        <ol className="senses">
          {entry.senses.map((s, i) => (
            <li key={i}>
              <span className="pos">{s.pos}</span>
              <span className="zh">{s.zh}</span>
              <span className="fr" lang="fr">
                {s.fr}
              </span>
            </li>
          ))}
        </ol>

        <section className="block">
          <h3 className="eyebrow">例句</h3>
          <ul className="examples">
            {entry.ex.map((x, i) => (
              <li key={i}>
                <span className={`ex-tag ${i ? "is-b2" : ""}`}>{i ? "B2 语境" : "日常"}</span>
                <p className="ex-fr" lang="fr">
                  <Highlight text={x.fr} word={entry.w} />
                  <Speak text={x.fr} label="" size="sm" />
                </p>
                <p className="ex-zh">{x.zh}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="block">
          <h3 className="eyebrow">常用搭配</h3>
          <ul className="collocations">
            {entry.col.map((c) => {
              const { fr, zh } = splitPair(c);
              return (
                <li key={c}>
                  <span lang="fr">{fr}</span>
                  {zh && <small>{zh}</small>}
                </li>
              );
            })}
          </ul>
        </section>

        {(famLinks.length > 0 || entry.syn.length > 0 || entry.ant.length > 0) && (
          <section className="block relations">
            {famLinks.length > 0 && (
              <div>
                <h3 className="eyebrow">词族</h3>
                <p>
                  {famLinks.map((f) =>
                    f.id && mode === "detail" ? (
                      <button key={f.label} className="link" onClick={() => openWord(f.id!)}>
                        {f.label}
                      </button>
                    ) : (
                      <span key={f.label}>{f.label}</span>
                    ),
                  )}
                </p>
              </div>
            )}
            {entry.syn.length > 0 && (
              <div>
                <h3 className="eyebrow">近义</h3>
                <p>{entry.syn.map((s) => <span key={s}>{s}</span>)}</p>
              </div>
            )}
            {entry.ant.length > 0 && (
              <div>
                <h3 className="eyebrow">反义</h3>
                <p>{entry.ant.map((s) => <span key={s}>{s}</span>)}</p>
              </div>
            )}
          </section>
        )}

        <aside className="tip">
          <Lightbulb size={17} strokeWidth={1.8} />
          <p>{entry.tip}</p>
        </aside>

        {entry.note && <p className="usage-note">用法提醒：{entry.note}</p>}

        {mode === "detail" && card && (
          <p className="memory-note">
            {card.due <= Date.now() ? "现在可以复习" : `下次复习：${formatInterval(card.due - Date.now())}后`} · 记忆稳定度 {card.s < 1 ? "<1" : Math.round(card.s)} 天 · 已复习 {card.reps} 次
          </p>
        )}
      </div>
    </article>
  );
}
