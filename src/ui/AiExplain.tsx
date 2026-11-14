import { Check, ChevronDown, Plus, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cacheGet, cachePut } from "../ai/cache";
import { getAiConfig, ready, useAiConfig } from "../ai/config";
import { explainWord, type WordExplanation } from "../ai/tasks";
import { useAtlas } from "../atlas/context";
import type { Entry } from "../atlas/types";
import { href, openWord } from "../lib/router";
import { addToCard, findSame, headOf, ownParts, removeFromCard, type CardItem } from "../store/decks";
import { useStore } from "../store/store";
import { SpeakBoth } from "./Speak";
import { toast } from "./Toast";

const OPEN_KEY = "word-atlas:ai-explain-open";
const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
};
const writeOpen = (v: boolean) => {
  try {
    localStorage.setItem(OPEN_KEY, v ? "1" : "0");
  } catch {
    /* private mode: just not remembered */
  }
};

interface Saved {
  at: number;
  provider: string;
  model: string;
  data: WordExplanation;
}

const PROVIDER: Record<string, string> = { openai: "OpenAI", deepseek: "DeepSeek", anthropic: "Anthropic", openrouter: "OpenRouter" };
const key = (e: Entry) => `explain:${e.id}:${e.w}`;

/** 加到卡片 for one item of the explanation: add it, take it off again, or say the card already has it. */
function Pick({ state, what = "加到卡片", onClick }: { state: "mine" | "card" | "none"; what?: string; onClick: () => void }) {
  return (
    <button
      className={`chip-btn ai-add ${state === "none" ? "" : "is-on"}`}
      onClick={onClick}
      disabled={state === "card"}
      aria-pressed={state === "mine"}
      title={state === "mine" ? "已经加到卡片上；点一下移除" : state === "card" ? "卡片上本来就有" : "加到这个词的卡片上"}
    >
      {state === "mine" ? (
        <>
          <Check size={13} /> 已加 · 移除
        </>
      ) : state === "card" ? (
        "卡片已有"
      ) : (
        <>
          <Plus size={13} /> {what}
        </>
      )}
    </button>
  );
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * AI 讲解: the word's senses with how they are used, near-synonyms and how they differ, antonyms, collocations,
 * points to watch and its family, written by the 生成卡片 service. Kept on this device after the first time.
 * Every item can be put on the card (加到卡片) and taken off again: meanings, examples, synonyms, antonyms,
 * collocations, points and family words.
 */
export function AiExplain({ entry }: { entry: Entry }) {
  const ai = useAiConfig();
  const atlas = useAtlas();
  const [saved, setSaved] = useState<Saved | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  // the full explanation is long: folded to its summary until the learner opens it (remembered on this device)
  const [open, setOpen] = useState(() => readOpen());
  const toggle = () =>
    setOpen((o) => {
      writeOpen(!o);
      return !o;
    });
  const ctrl = useRef<AbortController | null>(null);
  // what the learner added to this card themselves (removable), as opposed to the atlas's own text
  // (the selectors return stored values as they are: a new object here would re-render forever)
  const custom = useStore((s) => s.progress.custom);
  const edits = useStore((s) => s.progress.edits);
  const mine = ownParts({ custom, edits }, entry.id);

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
      setOpen(true);
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
  /** Whether the learner added it (mine), the card has it anyway (card), or neither. */
  const stateOf = (inMine: boolean, onCard: boolean): "mine" | "card" | "none" => (inMine ? "mine" : onCard ? "card" : "none");
  const put = (item: CardItem) => addToCard(entry.id, item) || toast("卡片上这一栏已经满了，先移除几条再加", "warn");

  const colState = (fr: string) => stateOf(!!mine.col?.some((c) => same(headOf(c), fr)), entry.col.some((c) => same(headOf(c), fr)));
  const tipState = (t: string) => stateOf((mine.tip ?? "").split("\n").some((x) => x.trim() === t.trim()), entry.tip.includes(t));
  const senseState = (zh: string) => stateOf(!!mine.senses?.some((x) => same(x.zh, zh)), entry.senses.some((x) => same(x.zh, zh)));
  const exState = (fr: string) => stateOf(!!mine.ex?.some((x) => same(x.fr, fr)), entry.ex.some((x) => same(x.en, fr)));
  const relState = (k: "syn" | "ant" | "fam", fr: string) => stateOf(!!mine[k]?.some((x) => same(headOf(x), fr)), entry[k].some((x) => same(headOf(x), fr)));
  const related = (x: { fr: string; zh: string }) => (x.zh ? `${x.fr} (${x.zh})` : x.fr);
  const relPick = (k: "syn" | "ant" | "fam", x: { fr: string; zh: string }) => {
    const st = relState(k, x.fr);
    return <Pick state={st} onClick={() => (st === "mine" ? removeFromCard(entry.id, { [k]: x.fr }) : put({ [k]: related(x) }))} />;
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
      {open && (
        <>
        <p className="muted small ai-how">每一条都可以「加到卡片」；加过的再点一下就移除，也可以在卡片上点 × 移除。</p>

        {d.senses.length > 0 && (
          <ol className="ai-senses">
            {d.senses.map((s, i) => {
              const st = senseState(s.zh);
              const xs = s.example ? exState(s.example) : "none";
              return (
                <li key={i}>
                  <p className="ai-sense-head">
                    <span>
                      {s.pos && <span className="pos">{s.pos}</span>} <b>{s.zh}</b>
                    </span>
                    <Pick state={st} what="加这个意思" onClick={() => (st === "mine" ? removeFromCard(entry.id, { sense: s.zh }) : put({ sense: { pos: s.pos, zh: s.zh } }))} />
                  </p>
                  {s.explain && <p className="ai-explain-text">{s.explain}</p>}
                  {s.example && (
                    <div className="ai-example">
                      <p>
                        <span lang="fr">{s.example}</span>
                        <SpeakBoth text={s.example} />
                        {s.exampleZh && <small>{s.exampleZh}</small>}
                      </p>
                      <Pick state={xs} what="加这条例句" onClick={() => (xs === "mine" ? removeFromCard(entry.id, { ex: s.example }) : put({ ex: { fr: s.example, zh: s.exampleZh } }))} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {(d.synonyms.length > 0 || d.antonyms.length > 0) && (
          <div className="ai-grid">
            {d.synonyms.length > 0 && (
              <div>
                <h4>近义词</h4>
                <ul className="ai-list ai-picks">
                  {d.synonyms.map((x) => (
                    <li key={x.fr}>
                      <span>
                        {word(x.fr)} <small>{x.zh}</small>
                        {x.diff && <span className="ai-diff">{x.diff}</span>}
                      </span>
                      {relPick("syn", x)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {d.antonyms.length > 0 && (
              <div>
                <h4>反义词</h4>
                <ul className="ai-list ai-picks">
                  {d.antonyms.map((x) => (
                    <li key={x.fr}>
                      <span>
                        {word(x.fr)} <small>{x.zh}</small>
                      </span>
                      {relPick("ant", x)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {d.collocations.length > 0 && (
          <>
            <h4>常用搭配</h4>
            <ul className="ai-list ai-picks">
              {d.collocations.map((c) => {
                const st = colState(c.fr);
                return (
                  <li key={c.fr}>
                    <span>
                      <span lang="fr">{c.fr}</span> <small>{c.zh}</small>
                    </span>
                    <Pick state={st} onClick={() => (st === "mine" ? removeFromCard(entry.id, { col: c.fr }) : put({ col: c.zh ? `${c.fr}｜${c.zh}` : c.fr }))} />
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
                const st = tipState(t);
                return (
                  <li key={t}>
                    <span>{t}</span>
                    <Pick state={st} onClick={() => (st === "mine" ? removeFromCard(entry.id, { tip: t }) : put({ tip: t }))} />
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {d.family.length > 0 && (
          <>
            <h4>词族</h4>
            <ul className="ai-list ai-picks">
              {d.family.map((x) => (
                <li key={x.fr}>
                  <span>
                    {word(x.fr)} <small>{x.zh}</small>
                  </span>
                  {relPick("fam", x)}
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="muted small ai-meta">
          由 {PROVIDER[saved.provider] ?? saved.provider} · {saved.model} 生成，{new Date(saved.at).toLocaleDateString("zh-CN")}；AI 写的内容可能有错，请对照词库核对。保存在这台设备上，再打开不重复收费。
        </p>
        </>
      )}
      <button className="link ai-toggle" onClick={toggle} aria-expanded={open}>
        <ChevronDown size={15} className={open ? "is-flipped" : ""} /> {open ? "收起讲解" : "展开全部讲解"}
      </button>
    </section>
  );
}
