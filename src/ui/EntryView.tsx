import { isNative } from "../lib/native";
import { DictionaryLinks } from "./DictionaryLinks";
import { Bookmark, BookmarkCheck, Check, Lightbulb, Pencil, Plus, Share2, X } from "lucide-react";
import { useState } from "react";
import { MEDIA, type Accent, type Entry } from "../atlas/types";
import { useAtlas } from "../atlas/context";
import { REGISTER_LABELS, splitPair } from "../lib/text";
import { useConfusables } from "../atlas/confusables";
import { isMastered } from "../store/srs";
import { store, toggleBookmark, useStore } from "../store/store";
import { Illustration } from "./Illustration";
import { Speak, SpeakBoth } from "./Speak";
import { shareWord } from "./share";
import { closeWord, href, openWord } from "../lib/router";
import { addToDeck, createDeck, dropMainSense, findSame, hideExample, hideSense, isCustomId, ownParts, removeFromCard, removeFromDeck, restoreExamples, restoreSenses } from "../store/decks";
import { WordForm } from "./WordForm";
import { AiExplain } from "./AiExplain";
import { ready, useAiConfig } from "../ai/config";
import { articleTone } from "../lib/gender";
import { AUX_NOTE, VerbConjugation } from "./ConjTable";
import { CORE_LABEL, isCore, PASSIVE_LABEL } from "../lib/core-words";
import { useConj } from "../atlas/conj";

/** Examples are numbered, not tagged by source; Tatoeba sentences keep their attribution (CC BY 2.0 FR). */
const TATOEBA = "Tatoeba";
const ART_TITLE: Record<string, string> = { un: "阳性名词", une: "阴性名词", "un/une": "阴阳同形", des: "复数形式" };

import { Highlight, Pronounce } from "./WordText";
export { Highlight, Pronounce };

const VOICE_LABEL = { uk: "女", us: "男" } as const;

/** Which recording bits an example has, female then male: the first example and the second one have their own. */
const EX_BITS = [
  { uk: MEDIA.ex, us: MEDIA.exM },
  { uk: MEDIA.ex2, us: MEDIA.ex2M },
] as const;

/** Which voices an example (0 = first, 1 = second) is recorded in. */
export function exampleVoices(entry: Entry, index = 0): Accent[] {
  const bits = EX_BITS[index];
  return bits ? (["uk", "us"] as const).filter((v) => entry.m & bits[v]) : [];
}

/**
 * 女 / 男 for an example that is played rather than shown with its own buttons (dictation): picking one reads the
 * sentence in that voice and keeps it for the next sentences. Nothing is shown when only one voice is recorded.
 */
export function VoicePick({ entry, index = 0, value, onPick }: { entry: Entry; index?: number; value: Accent; onPick: (v: Accent) => void }) {
  const ai = useAiConfig();
  const recorded = exampleVoices(entry, index);
  // a sentence with no recording (one the AI wrote) is read by the speech service, which has both a female and a male voice
  const voices: Accent[] = recorded.length === 0 && ready.tts(ai) ? ["uk", "us"] : recorded;
  if (voices.length < 2) return null;
  return (
    <span className="voice-pick" role="group" aria-label="例句朗读声音">
      {voices.map((v) => (
        <button key={v} type="button" className={value === v ? "is-on" : ""} aria-pressed={value === v} aria-label={`${VOICE_LABEL[v]}声朗读例句`} onClick={(ev) => { ev.stopPropagation(); onPick(v); }}>
          {VOICE_LABEL[v]}
        </button>
      ))}
    </span>
  );
}

/** An example's read-aloud: 女 and 男 when both recordings exist, like the headword; otherwise one button. */
function ExampleSpeak({ entry, index, text }: { entry: Entry; index: number; text: string }) {
  const atlas = useAtlas();
  const kind = index === 0 ? "ex" : "ex2";
  const voices = exampleVoices(entry, index);
  if (!voices.length) return <SpeakBoth text={text} className="ex-speak" />;
  if (voices.length < 2) return <Speak url={index < 2 ? atlas.audio(entry, kind) : null} text={text} size="sm" className="ex-speak" />;
  return (
    <span className="ex-voices">
      {voices.map((v) => (
        <Speak key={v} url={atlas.audio(entry, kind, v)} text={text} accent={v} size="sm" ariaLabel={`${VOICE_LABEL[v]}声朗读例句`} label={<em>{VOICE_LABEL[v]}</em>} />
      ))}
    </span>
  );
}

const CJK_RE = /[\u3400-\u9fff]/;
const POS_TAG_RE = /^(?:n\.(?:\s*(?:m\.|f\.|m\.\/f\.))?|v\.(?:\s*(?:t\.|i\.|pr\.))?|adj\.|adv\.|prép\.|conj\.|pron\.|interj\.|loc\.(?:\s*[a-zé]+\.)?)$/i;

/**
 * A related-word label as stored on a card: "bonheur｜幸福", "réception (接待)", "ostracisme (n.m.)" or plain "accueillir".
 * A trailing parenthetical is taken as the hint when it contains CJK or a POS tag ("s'asseoir (pronominal)" stays French).
 */
export function parseRelLabel(label: string): { fr: string; zh: string } {
  const [head = "", ...rest] = label.split(/[｜|]/);
  let fr = head.trim();
  let zh = rest.join("｜").trim();
  if (!zh) {
    const m = fr.match(/^(.*?)\s*[（(]([^()（）]*)[)）]\s*$/);
    const note = m?.[2]?.trim() ?? "";
    if (m && m[1].trim() && (CJK_RE.test(note) || POS_TAG_RE.test(note))) {
      fr = m[1].trim();
      zh = note;
    }
  }
  return { fr, zh };
}

export function EntryView({ entry, mode = "detail", eager = true }: { entry: Entry; mode?: "detail" | "intro" | "reveal"; eager?: boolean }) {
  const atlas = useAtlas();
  const ref = atlas.byId.get(entry.id);
  const card = useStore((s) => s.progress.cards[entry.id]);
  const saved = useStore((s) => s.progress.bookmarks.includes(entry.id));
  const topicIdx = atlas.topics.findIndex((t) => t[0] === entry.topic);
  const topic = atlas.topics[topicIdx];
  // a related word opens its atlas card when it is in the lexicon, otherwise its dictionary entry (#/dict?w=…)
  const toLinks = (list: string[]) =>
    list.map((label) => {
      const { fr, zh } = parseRelLabel(label);
      const bare = fr.replace(/\s*\([^)]*\)\s*$/, "").trim();
      const lower = (bare || fr).toLowerCase();
      const hit =
        (fr ? findSame(atlas, fr)[0] : undefined) ??
        (bare && bare !== fr ? findSame(atlas, bare)[0] : undefined) ??
        atlas.words.find((x) => x.word.toLowerCase() === lower);
      return { label, fr, zh, id: hit?.id };
    });
  const famLinks = toLinks(entry.fam);
  const synLinks = toLinks(entry.syn);
  const antLinks = toLinks(entry.ant);
  // what the learner put on this card themselves: in the detail view each of these can be taken off again (×)
  const customAll = useStore((s) => s.progress.custom);
  const editsAll = useStore((s) => s.progress.edits);
  const own = ownParts({ custom: customAll, edits: editsAll }, entry.id);
  const canRemove = mode === "detail";
  const rm = (what: Parameters<typeof removeFromCard>[1]) =>
    canRemove && (
      <button className="own-rm" onClick={() => removeFromCard(entry.id, what, entry)} aria-label="从卡片上移除" title="从卡片上移除">
        <X size={13} />
      </button>
    );
  const x = (onClick: () => void, title: string) => (
    <button className="own-rm" onClick={onClick} aria-label="从卡片上去掉这个意思" title={title}>
      <X size={13} />
    </button>
  );
  const hiddenSenses = editsAll?.[entry.id]?.hide?.length ?? 0;
  const hiddenExamples = editsAll?.[entry.id]?.hideEx?.length ?? 0;
  /** × on an example: one the learner added is deleted; one of the atlas's is taken off the card (恢复 brings it back). */
  const exampleRm = (ex: Entry["ex"][number], i: number) => {
    if (!canRemove) return null;
    if (ex.origin === "mine" || ex.origin === "tatoeba" || isCustomId(entry.id))
      return (
        <button className="own-rm" onClick={() => removeFromCard(entry.id, { ex: ex.en })} aria-label={`删除例句 ${i + 1}`} title="删除这个例句">
          <X size={13} />
        </button>
      );
    const atlasList = entry.orig?.ex ?? entry.ex;
    const n = atlasList.findIndex((o) => o.en === ex.en);
    if (n < 0) return null;
    return (
      <button className="own-rm" onClick={() => hideExample(entry.id, n)} aria-label={`删除例句 ${i + 1}`} title="词库原有的例句：从卡片上去掉（可以恢复）">
        <X size={13} />
      </button>
    );
  };
  /** × on a meaning: one the learner added is deleted; one of the atlas's is taken off (恢复 brings it back). The last one stays. */
  const senseRm = (s: Entry["senses"][number], i: number) => {
    if (!canRemove || entry.senses.length < 2) return null;
    const added = own.senses?.some((o) => o.zh === s.zh) && (isCustomId(entry.id) ? i > 0 : s.n === undefined);
    if (added) return rm({ sense: s.zh });
    if (isCustomId(entry.id)) return x(() => dropMainSense(entry.id), "去掉这个意思，下一个意思排到第一");
    return x(() => hideSense(entry.id, s.n ?? i), "词库原有的意思：从卡片上去掉（可以恢复）");
  };
  const linkList = (links: { label: string; fr: string; zh: string; id?: string }[], k: "fam" | "syn" | "ant") =>
    links.map((f) => {
      const text = f.fr ? (
        <>
          <span lang="fr">{f.fr}</span>
          {f.zh && <small className="rel-zh">{f.zh}</small>}
        </>
      ) : (
        f.label
      );
      return (
        <span key={f.label} className="rel-item">
          {mode !== "detail" ? (
            <span>{text}</span>
          ) : f.id ? (
            <button className="link" onClick={() => openWord(f.id!)}>
              {text}
            </button>
          ) : f.fr ? (
            <a className="link" href={href({ page: "dict", w: f.fr })} title={`查看「${f.fr}」词条`}>
              {text}
            </a>
          ) : (
            <span>{text}</span>
          )}
          {rm({ [k]: f.label })}
        </span>
      );
    });
  const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);
  // the rest of the 注意点 is the atlas's own (an own word has none besides the learner's)
  const atlasTip = own.tip && entry.tip.startsWith(own.tip) ? entry.tip.slice(own.tip.length).trim() : own.tip ? "" : entry.tip;
  const tipItems = [...lines(own.tip ?? "").map((text) => ({ text, own: true })), ...lines(atlasTip).map((text) => ({ text, own: false }))];
  const status = card ? (isMastered(card) ? "已掌握" : "学习中") : null;
  const mine = isCustomId(entry.id);
  const wikiSources = useStore(s => s.progress.custom?.[entry.id]?.wikiSources ?? s.progress.edits?.[entry.id]?.wikiSources);
  const [editing, setEditing] = useState(false);

  return (
    <article className={`entry entry-${mode} ${entry.noImg ? "entry-noimg" : ""}`}>
      {!entry.noImg && (
        <div className="entry-art">
          <Illustration src={atlas.img(entry)} word={entry.w} topic={topicIdx} eager={eager} alt={`${entry.w} 插画`} art={entry.art} />
        </div>
      )}
      <div className="entry-body">
        <header className="entry-head">
          <div className="entry-tags">
            {mine ? (
              <span className="chip chip-mine">自建词</span>
            ) : (
              <span className={`chip chip-level lv-${entry.cefr}`}>{entry.levelStatus === "estimated" ? `推定 ${entry.cefr}` : entry.cefr}</span>
            )}
            {!mine && (isCore(atlas, entry.id) ? <span className="chip" title="写作、口语要能用出来">{CORE_LABEL}</span> : <span className="chip" title="看懂就行">{PASSIVE_LABEL}</span>)}
            {topic && <span className="chip">{topic[1]}</span>}
            {entry.register && (
              <span className={`chip chip-reg reg-${entry.register}`} title="语域登记">
                {REGISTER_LABELS[entry.register]}
              </span>
            )}
            {status && <span className={`chip chip-status ${status === "已掌握" ? "is-done" : ""}`}>{status}</span>}
          </div>
          {mode !== "detail" && (
            <div className="entry-actions">
              <button className={`icon-btn ${editing ? "is-on" : ""}`} onClick={() => setEditing((v) => !v)} aria-pressed={editing} aria-label="编辑这个词" title={mine ? "编辑" : "改释义和例句"}>
                <Pencil size={18} />
              </button>
            </div>
          )}
          {mode === "detail" && (
            <div className="entry-actions">
              <button className={`icon-btn ${editing ? "is-on" : ""}`} onClick={() => setEditing((v) => !v)} aria-pressed={editing} aria-label="编辑这个词" title={mine ? "编辑" : "改释义和例句"}>
                <Pencil size={18} />
              </button>
              <button className={`icon-btn ${saved ? "is-on" : ""}`} onClick={() => toggleBookmark(entry.id)} aria-pressed={saved} aria-label={saved ? "取消收藏" : "收藏"} title={saved ? "取消收藏" : "收藏"}>
                {saved ? <BookmarkCheck size={19} /> : <Bookmark size={19} />}
              </button>
              <button className="icon-btn" onClick={() => shareWord(atlas, entry)} aria-label="生成分享卡片" title="生成分享卡片">
                <Share2 size={19} />
              </button>
            </div>
          )}
        </header>
        {ref && ref.order >= 0 && (
          <p className="specimen">
            № {String(ref.order + 1).padStart(4, "0")}
            <i />
            Atlas du français
          </p>
        )}
        <h2 className="headword" lang="fr">
          {entry.art && (
            <span className={`art ${articleTone(entry.art)}`} title={ART_TITLE[entry.art]}>
              {entry.art}
            </span>
          )}
          {entry.w}
        </h2>
        {entry.forms && (
          <p className="forms">
            阳性 <b lang="fr">{entry.forms.m}</b> · 阴性 <b lang="fr">{entry.forms.f}</b> · 复数 <span lang="fr">{entry.forms.mPl} / {entry.forms.fPl}</span>
          </p>
        )}
        <Inflections entry={entry} />
        <Pronounce entry={entry} refw={ref ?? entry} />
        <DictionaryLinks word={entry.w} />
        {wikiSources?.length ? <p className="wiki-attribution">导入自 Wiktionnaire（CC BY-SA）：{wikiSources.map((url,i)=><a key={url} href={url} target={isNative() ? "_self" : "_blank"} rel="noopener noreferrer">原文版本 {i+1} </a>)}</p> : null}

        {editing && (
          <section className="block entry-edit">
            <h3 className="eyebrow">{mine ? "编辑自建词" : "我的修改 · 所有卡组都会这样显示"}</h3>
            {mine ? (
              <WordForm
                mode="custom"
                id={entry.id}
                onDone={(id) => {
                  setEditing(false);
                  if (!id && !store.get().progress.custom?.[entry.id]) closeWord();
                }}
              />
            ) : (
              <WordForm mode="atlas" id={entry.id} original={{ zh: atlas.byId.get(entry.id)?.zh ?? entry.senses[0]?.zh ?? "" }} onDone={() => setEditing(false)} />
            )}
          </section>
        )}

        <ol className={`senses ${entry.senses.length > 1 ? "is-multi" : ""}`}>
          {entry.senses.map((s, i) => (
            <li key={i}>
              {entry.senses.length > 1 && <span className="sense-no" aria-label={`义项 ${i + 1}`}>{i + 1}</span>}
              <span className="pos">{s.pos === "待核实" ? "" : s.pos}</span>
              <span className="zh">
                {s.zh}
                {senseRm(s, i)}
              </span>
              {s.en && (
                <span className="en" lang="fr">
                  {s.en}
                </span>
              )}
            </li>
          ))}
        </ol>

        {canRemove && hiddenSenses > 0 && (
          <p className="muted small senses-hidden">
            已从卡片上去掉 {hiddenSenses} 个词库原有的意思
            <button className="link" onClick={() => restoreSenses(entry.id)}>
              恢复
            </button>
          </p>
        )}

        {(mode === "detail" || mode === "intro") && <AiExplain key={entry.id} entry={entry} />}

        {entry.ex.length > 0 && (
          <section className="block">
            <h3 className="eyebrow">例句</h3>
            <ul className="examples">
              {entry.ex.map((x, i) => (
                <li key={`${i}-${x.en}`} className="ex-item">
                  <span className="sense-no ex-no" aria-label={`例句 ${i + 1}`}>
                    {i + 1}
                  </span>
                  <div className="ex-body">
                    <p className="ex-en" lang="fr">
                      <Highlight text={x.en} word={entry.w} span={x.hl} />
                      <ExampleSpeak entry={entry} index={i} text={x.en} />
                    </p>
                    <p className="ex-zh">
                      {x.zh}
                      {x.origin === "tatoeba" && <small className="ex-src">{TATOEBA}</small>}
                    </p>
                  </div>
                  {exampleRm(x, i)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {canRemove && hiddenExamples > 0 && (
          <p className="muted small senses-hidden">
            已从卡片上去掉 {hiddenExamples} 个词库例句
            <button className="link" onClick={() => restoreExamples(entry.id)}>
              恢复
            </button>
          </p>
        )}

        {mode === "detail" && entry.senses[0]?.pos === "v." && (
          <>
            <VerbConjugation id={entry.id} />
            <p className="muted small conj-full-link">
              <a className="link" href={href({ page: "dict", w: entry.w, tab: "conj" })}>
                词典里查看「{entry.w}」完整变位 →
              </a>
            </p>
          </>
        )}

        {entry.col.length > 0 && (
          <section className="block">
            <h3 className="eyebrow">常用搭配</h3>
            <ul className="collocations">
              {entry.col.map((c) => {
                const { en, zh } = splitPair(c);
                return (
                  <li key={c}>
                    <span lang="fr">{en}</span>
                    {zh && <small>{zh}</small>}
                    {rm({ col: c })}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {(famLinks.length > 0 || entry.syn.length > 0 || entry.ant.length > 0) && (
          <section className="block relations">
            {famLinks.length > 0 && (
              <div>
                <h3 className="eyebrow">词族</h3>
                <p>{linkList(famLinks, "fam")}</p>
              </div>
            )}
            {entry.syn.length > 0 && (
              <div>
                <h3 className="eyebrow">近义</h3>
                <p>{linkList(synLinks, "syn")}</p>
              </div>
            )}
            {entry.ant.length > 0 && (
              <div>
                <h3 className="eyebrow">反义</h3>
                <p>{linkList(antLinks, "ant")}</p>
              </div>
            )}
          </section>
        )}

        <ConfusableBlock id={entry.id} />

        {entry.tip && (
          <aside className="tip">
            <Lightbulb size={17} strokeWidth={1.8} />
            {/* one point per line, each its own numbered item */}
            <ol className={`tip-list ${tipItems.length > 1 ? "is-multi" : ""}`}>
              {tipItems.map((t, i) => (
                <li key={`${i}-${t.text}`}>
                  <span>{t.text}</span>
                  {rm({ tip: t.text })}
                </li>
              ))}
            </ol>
          </aside>
        )}

        {mode === "detail" && <DeckChips id={entry.id} />}

        {mode === "detail" && card && (
          <p className="memory-note">
            记忆稳定度 {card.s < 1 ? "<1" : Math.round(card.s)} 天 · 已复习 {card.reps} 次
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * 所在卡组: tick the decks this word belongs to. The initial deck is ticked unless the word was hidden from it.
 * Progress is the word's, so moving it between decks never changes what was learned.
 */
function DeckChips({ id }: { id: string }) {
  const decks = useStore((s) => s.progress.decks) ?? [];

  const [name, setName] = useState<string | null>(null);
  const rows: { id: string; name: string; on: boolean }[] = [
    ...decks.map((d) => ({ id: d.id, name: d.name, on: d.words.includes(id) })),
  ];
  return (
    <section className="block deck-chips">
      <h3 className="eyebrow">
        所在卡组 <a href={href({ page: "decks" })}>管理卡组</a>
      </h3>
      <ul className="chips">
        {rows.map((r) => (
          <li key={r.id}>
            <button className={`chip-btn ${r.on ? "is-on" : ""}`} aria-pressed={r.on} onClick={() => (r.on ? removeFromDeck(r.id, id) : addToDeck(r.id, id))}>
              {r.on && <Check size={14} />} {r.name}
            </button>
          </li>
        ))}
        <li>
          {name === null ? (
            <button className="chip-btn chip-add" onClick={() => setName("")}>
              <Plus size={14} /> 新建卡组
            </button>
          ) : (
            <form
              className="deck-chip-new"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return setName(null);
                addToDeck(createDeck(name), id);
                setName(null);
              }}
            >
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="卡组名称" maxLength={40} autoFocus onBlur={() => !name.trim() && setName(null)} />
              <button className="btn btn-primary btn-sm">加入</button>
            </form>
          )}
        </li>
      </ul>
      {rows.length > 0 && rows.every((r) => !r.on) && <p className="deck-chips-note">不在任何卡组里：学习记录保留，但暂停复习。</p>}
    </section>
  );
}

/** "Easily confused with": the comparison groups this word belongs to, linked to the 辨析 page. */
function ConfusableBlock({ id }: { id: string }) {
  const { data } = useConfusables();
  const groups = (data?.byEntry[id] ?? []).map((gid) => data!.groups.find((g) => g.id === gid)).filter((g): g is NonNullable<typeof g> => !!g).slice(0, 3);
  if (!groups.length) return null;
  return (
    <section className="block confusables">
      <h3 className="eyebrow">易混词</h3>
      <ul>
        {groups.map((g) => (
          <li key={g.id}>
            <a href={href({ page: "compare", g: g.id })}>
              <b lang="fr">{g.title}</b>
              <span>{g.zh}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The forms a learner cannot guess: irregular plural, adjective feminine, where the adjective goes, a verb's auxiliary. */
function Inflections({ entry }: { entry: Entry }) {
  const i = entry.infl;
  const verb = entry.senses[0]?.pos === "v.";
  const items: [string, string][] = [];
  if (i?.pl) items.push(["复数", i.pl]);
  if (i?.fem) items.push(["阴性", i.fem]);
  if (i?.mpl) items.push(["阳性复数", i.mpl]);
  if (!items.length && !i?.place && !verb) return null;
  return (
    <div className="infl">
      {items.length > 0 && (
        <p className="infl-forms">
          {items.map(([label, form]) => (
            <span key={label}>
              {label} <b lang="fr">{form}</b>
            </span>
          ))}
        </p>
      )}
      {verb && <VerbAux id={entry.id} />}
      {i?.place && <p className="infl-note">位置：{i.place}</p>}
    </div>
  );
}

function VerbAux({ id }: { id: string }) {
  const { data } = useConj();
  const v = data?.verbs[id];
  if (!v) return null;
  return (
    <p className={`infl-forms infl-aux ${v.p || v.a !== "a" ? "is-etre" : ""}`}>
      <span>
        过去分词 <b lang="fr">{v.pp}</b>
      </span>
      <span>{v.p ? AUX_NOTE.e : AUX_NOTE[v.a]}</span>
    </p>
  );
}
