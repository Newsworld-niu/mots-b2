import { Keyboard, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { WORD_ORDER, type WordEntry } from "../data";
import { accuracyOf, hashSeed, shuffle, tokens } from "../lib/fr";
import { go } from "../lib/router";
import { store, useStore, type TypingRound } from "../store/store";
import { Speak } from "../ui/Speak";

type Mode = TypingRound["mode"];
interface Item {
  word: WordEntry;
  fr: string;
  zh: string;
}

/** Every example sentence becomes one exercise item. */
const ITEMS: Item[] = shuffle(
  WORD_ORDER.flatMap((w) => w.ex.map((e) => ({ word: w, fr: e.fr, zh: e.zh }))),
  hashSeed("practice-v1"),
);

export function Practice() {
  const typing = useStore((s) => s.progress.typing);
  const [mode, setMode] = useState<Mode>("dictee");
  const [i, setI] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<{ acc: number; wpm: number } | null>(null);
  const shownAt = useRef(Date.now());
  const item = ITEMS[i % ITEMS.length];

  const avg = typing.length ? Math.round(typing.reduce((a, t) => a + t.accuracy, 0) / typing.length) : null;
  const best = typing.reduce((m, t) => Math.max(m, t.wpm), 0);

  const submit = () => {
    if (result || !value.trim()) return;
    const acc = accuracyOf(value, item.fr);
    const minutes = Math.max(0.05, (Date.now() - shownAt.current) / 60000);
    const words = tokens(item.fr).length;
    const wpm = Math.round(words / minutes);
    setResult({ acc, wpm });
    store.progress((p) => ({
      ...p,
      typing: [{ at: Date.now(), mode, items: 1, wpm, accuracy: acc }, ...p.typing].slice(0, 50),
    }));
  };

  const next = () => {
    setI((x) => x + 1);
    setValue("");
    setResult(null);
    shownAt.current = Date.now();
  };

  return (
    <div className="page practice">
      <header className="page-head">
        <p className="eyebrow">Mots B2 · 练习</p>
        <h1 className="display">听写与译写</h1>
        <p className="lede">听一句法语，或读一句中文，写出完整的法语句子。系统按字符编辑距离计算准确率，并估算词速。</p>
      </header>

      <div className="practice-grid">
        <section className="panel practice-card">
          <div className="chips" role="tablist" aria-label="练习模式">
            <button role="tab" aria-selected={mode === "dictee"} className={`chip-btn ${mode === "dictee" ? "is-on" : ""}`} onClick={() => { setMode("dictee"); next(); }}>
              听写
            </button>
            <button role="tab" aria-selected={mode === "traduction"} className={`chip-btn ${mode === "traduction" ? "is-on" : ""}`} onClick={() => { setMode("traduction"); next(); }}>
              译写
            </button>
          </div>

          <p className="eyebrow">{mode === "dictee" ? "听写 · 写出你听到的句子" : "译写 · 把中文译成法语"}</p>
          {mode === "dictee" ? (
            <div className="prompt-audio">
              <Speak text={item.fr} label="播放" />
              <span className="hint-line">点击“播放”朗读，可反复听</span>
            </div>
          ) : (
            <p className="prompt-zh">{item.zh}</p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={!!result}
              rows={3}
              lang="fr"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="在这里输入法语句子（注意重音和标点）"
              aria-label="输入法语句子"
            />
            {!result ? (
              <button className="btn btn-primary btn-xl" type="submit" disabled={!value.trim()}>
                <Keyboard size={18} /> 提交
              </button>
            ) : (
              <div className="result">
                <p className="result-stats">
                  准确率 <b>{result.acc}%</b> · 词速 <b>{result.wpm}</b> 词/分
                </p>
                <p className="result-fr" lang="fr">
                  正确答案：{item.fr}
                </p>
                <p className="ex-zh">{item.zh}</p>
                <p className="result-word">词条：<button className="link" onClick={() => go("atlas", { word: item.word.id })} lang="fr">{item.word.w}</button></p>
                <button className="btn btn-primary btn-xl" type="button" onClick={next}>
                  下一句
                </button>
              </div>
            )}
          </form>
        </section>

        <aside className="panel practice-side">
          <h3 className="eyebrow">你的练习</h3>
          <dl className="mini-stats">
            <div>
              <dt>练习次数</dt>
              <dd>{typing.length}</dd>
            </div>
            <div>
              <dt>平均准确率</dt>
              <dd>{avg === null ? "—" : `${avg}%`}</dd>
            </div>
            <div>
              <dt>最快词速</dt>
              <dd>{best || "—"}</dd>
            </div>
          </dl>
          <ul className="history">
            {typing.slice(0, 8).map((t) => (
              <li key={t.at}>
                <span>{t.mode === "dictee" ? "听写" : "译写"}</span>
                <b>{t.accuracy}%</b>
                <small>{t.wpm} 词/分</small>
              </li>
            ))}
            {typing.length === 0 && <li className="empty">还没有记录。写完第一句，这里就会出现成绩。</li>}
          </ul>
          <button className="btn btn-glass" onClick={() => setI((x) => x + 1)}>
            <RotateCcw size={16} /> 换一句
          </button>
        </aside>
      </div>
    </div>
  );
}
