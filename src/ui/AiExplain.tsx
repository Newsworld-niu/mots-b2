import { Check, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cacheGet, cachePut } from "../ai/cache";
import { getAiConfig, ready, useAiConfig } from "../ai/config";
import { explainWord, type WordExplanation } from "../ai/tasks";
import { useAtlas } from "../atlas/context";
import type { Entry } from "../atlas/types";
import { href, openWord } from "../lib/router";
import { addToCard, findSame, isCustomId, removeFromCard } from "../store/decks";
import { useStore } from "../store/store";
import { Speak } from "./Speak";
import { toast } from "./Toast";

interface Saved {
  at: number;
  provider: string;
  model: string;
  data: WordExplanation;
}

const PROVIDER: Record<string, string> = { openai: "OpenAI", deepseek: "DeepSeek", anthropic: "Anthropic", openrouter: "OpenRouter" };
const key = (e: Entry) => `explain:${e.id}:${e.w}`;

/**
 * AI 讲解: the word's senses with how they are used, near-synonyms and how they differ, antonyms, collocations,
 * points to watch and its family, written by the 生成卡片 service. Kept on this device after the first time.
 * Collocations and points can be put on the card (加到卡片) and taken off again.
 */
export function AiExplain({ entry }: { entry: Entry }) {
  const ai = useAiConfig();
  const atlas = useAtlas();
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const ctrl = useRef<AbortController | null>(null);
  // what the learner added to this card themselves (removable), as opposed to the atlas's own text
  // (the selectors return stored values as they are: a new object here would re-render forever)
  const own = isCustomId(entry.id);
  const mineCols = useStore((s) => (own ? s.progress.custom?.[entry.id]?.col : s.progress.edits?.[entry.id]?.col));
  const mineTip = useStore((s) => (own ? s.progress.custom?.[entry.id]?.note : s.progress.edits?.[entry.id]?.tip));
  const mine = { col: mineCols ?? [], tip: mineTip ?? "" };

  useEffect(() => {
    let live = true;
    setSaved(undefined);
    void cacheGet<Saved>(key(entry)).then((x) => live && setSaved(x ?? null));
    return () => {
      live = false;
      ctrl.current?.abort();
    };
  }, [entry.id, entry.w]);

  const run = async () => {
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    try {
      const data = await explainWord(
        { word: entry.w, pos: entry.senses.map((s) => s.pos).filter(Boolean).join(" / "), zh: entry.senses.map((s) => s.zh).filter(Boolean).join("；"), examples: entry.ex.map((x) => x.en) },
        c.signal,
      );
      const cfg = getAiConfig();
      const next: Saved = { at: Date.now(), provider: cfg.text.provider, model: cfg.text.model, data };
      await cachePut(key(entry), next);
      setSaved(next);
    } catch (e) {
      if (!c.signal.aborted) toast((e as Error).message || "生成失败", "warn");
    } finally {
      setBusy(false);
    }
  };

  if (saved === undefined) return null;
  if (!saved)
    return (
      <section className="block ai-explain">
        <h3 className="eyebrow">AI 讲解</h3>
        {ready.text(ai) ? (
          <button className="btn btn-ghost" onClick={run} disabled={busy}>
            <Sparkles size={16} /> {busy ? "生成中（约 10–30 秒）…" : "让 AI 讲解这个词：意思、近义反义、搭配、注意点"}
          </button>
        ) : (
          <p className="muted small">
            在 <a href={href({ page: "me" })}>我的 → AI 接口</a> 设置生成卡片服务后，可以让 AI 讲解这个词。
          </p>
        )}
      </section>
    );

  const d = saved.data;
  const onCardCol = (fr: string) => entry.col.some((c) => c.split("｜")[0].trim().toLowerCase() === fr.trim().toLowerCase());
  const mineCol = (fr: string) => mine.col.find((c) => c.split("｜")[0].trim().toLowerCase() === fr.trim().toLowerCase());
  const onCardTip = (t: string) => entry.tip.includes(t);
  const link = (fr: string) => findSame(atlas, fr)[0]?.id;
  const word = (fr: string) => {
    const id = link(fr);
    return id ? (
      <button className="link" lang="fr" onClick={() => openWord(id)}>
        {fr}
      </button>
    ) : (
      <b lang="fr">{fr}</b>
    );
  };
  const toggleCol = (fr: string, zh: string) => {
    const have = mineCol(fr);
    if (have) removeFromCard(entry.id, { col: have });
    else if (!onCardCol(fr)) addToCard(entry.id, { col: [zh ? `${fr}｜${zh}` : fr] });
  };
  const toggleTip = (t: string) => {
    if (mine.tip.split("\n").some((x) => x.trim() === t)) removeFromCard(entry.id, { tip: t });
    else if (!onCardTip(t)) addToCard(entry.id, { tip: t });
  };

  return (
    <section className="block ai-explain">
      <h3 className="eyebrow">
        AI 讲解
        <button className="link ai-redo" onClick={run} disabled={busy} title="重新生成">
          <RefreshCw size={13} /> {busy ? "生成中…" : "重新生成"}
        </button>
      </h3>
      {d.summary && <p className="ai-summary">{d.summary}</p>}

      {d.senses.length > 0 && (
        <ol className="ai-senses">
          {d.senses.map((s, i) => (
            <li key={i}>
              <p>
                {s.pos && <span className="pos">{s.pos}</span>} <b>{s.zh}</b>
              </p>
              {s.explain && <p className="ai-explain-text">{s.explain}</p>}
              {s.example && (
                <p className="ai-example">
                  <span lang="fr">{s.example}</span>
                  <Speak url={null} text={s.example} size="sm" />
                  {s.exampleZh && <small>{s.exampleZh}</small>}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {(d.synonyms.length > 0 || d.antonyms.length > 0) && (
        <div className="ai-grid">
          {d.synonyms.length > 0 && (
            <div>
              <h4>近义词</h4>
              <ul className="ai-list">
                {d.synonyms.map((x) => (
                  <li key={x.fr}>
                    {word(x.fr)} <small>{x.zh}</small>
                    {x.diff && <p className="ai-diff">{x.diff}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.antonyms.length > 0 && (
            <div>
              <h4>反义词</h4>
              <ul className="ai-list">
                {d.antonyms.map((x) => (
                  <li key={x.fr}>
                    {word(x.fr)} <small>{x.zh}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {d.collocations.length > 0 && (
        <>
          <h4>常用搭配 <small>点「加到卡片」放进这个词的常用搭配</small></h4>
          <ul className="ai-list ai-picks">
            {d.collocations.map((c) => {
              const added = !!mineCol(c.fr);
              const atlasHas = onCardCol(c.fr) && !added;
              return (
                <li key={c.fr}>
                  <span lang="fr">{c.fr}</span> <small>{c.zh}</small>
                  <button className={`chip-btn ai-add ${added || atlasHas ? "is-on" : ""}`} onClick={() => toggleCol(c.fr, c.zh)} disabled={atlasHas} aria-pressed={added}>
                    {added ? <><Check size={13} /> 已加到卡片</> : atlasHas ? "词库已有" : <><Plus size={13} /> 加到卡片</>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {d.tips.length > 0 && (
        <>
          <h4>注意点</h4>
          <ul className="ai-list ai-picks">
            {d.tips.map((t) => {
              const added = mine.tip.split("\n").some((x) => x.trim() === t);
              return (
                <li key={t}>
                  <span>{t}</span>
                  <button className={`chip-btn ai-add ${added ? "is-on" : ""}`} onClick={() => toggleTip(t)} aria-pressed={added}>
                    {added ? <><Check size={13} /> 已加到卡片</> : <><Plus size={13} /> 加到卡片</>}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {d.family.length > 0 && (
        <>
          <h4>词族</h4>
          <p className="ai-family">
            {d.family.map((x, i) => (
              <span key={x.fr}>
                {i > 0 && " · "}
                {word(x.fr)} <small>{x.zh}</small>
              </span>
            ))}
          </p>
        </>
      )}

      <p className="muted small ai-meta">
        由 {PROVIDER[saved.provider] ?? saved.provider} · {saved.model} 生成，{new Date(saved.at).toLocaleDateString("zh-CN")}；AI 写的内容可能有错，请对照词库核对。保存在这台设备上，再打开不重复收费。
      </p>
    </section>
  );
}
