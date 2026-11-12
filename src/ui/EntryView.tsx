import { Bookmark, BookmarkCheck, Check, Lightbulb, Pencil, Plus, Share2 } from "lucide-react";
import { useState } from "react";
import { MEDIA, type Accent, type Entry, type WordRef } from "../atlas/types";
import { useAtlas } from "../atlas/context";
import { splitHighlight, splitPair, type Span } from "../lib/text";
import { useConfusables } from "../atlas/confusables";
import { isMastered } from "../store/srs";
import { store, toggleBookmark, useStore } from "../store/store";
import { Illustration } from "./Illustration";
import { Speak } from "./Speak";
import { shareWord } from "./share";
import { closeWord, href, openWord } from "../lib/router";
import { addToDeck, CORE_NAME, createDeck, isCustomId, removeFromDeck } from "../store/decks";
import { CORE_DECK } from "../store/store";
import { WordForm } from "./WordForm";
import { AiExplain } from "./AiExplain";
import { articleTone } from "../lib/gender";
import { AUX_NOTE, VerbConjugation } from "./ConjTable";
import { liaisonPoints } from "../lib/liaison";
import { useConj } from "../atlas/conj";

/** Where an example comes from; supplement examples carry no tag. */
const EX_TAG: Record<string, string> = { book: "书中例句", mine: "我的例句", tatoeba: "Tatoeba 例句" };
const ART_TITLE: Record<string, string> = { un: "阳性名词", une: "阴性名词", "un/une": "阴阳同形", des: "复数形式" };

export function Highlight({ text, word, span }: { text: string; word: string; span?: Span | null }) {
  const parts = splitHighlight(text, word, span);
  const points = liaisonPoints(text);
  if (!parts) return <>{withLiaison(text, 0, points)}</>;
  return (
    <>
      {withLiaison(parts[0], 0, points)}
      <mark>{withLiaison(parts[1], parts[0].length, points)}</mark>
      {withLiaison(parts[2], parts[0].length + parts[1].length, points)}
    </>
  );
}

/** `piece` (which starts at `offset` in the sentence) with each liaison space drawn as a ‿ tie. */
function withLiaison(piece: string, offset: number, points: number[]) {
  const here = points.filter((p) => p >= offset && p < offset + piece.length).map((p) => p - offset);
  if (!here.length) return piece;
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const p of here) {
    out.push(piece.slice(last, p), <span key={p} className="liaison" title="连诵">
        <span aria-hidden="true">‿</span>
        <span className="sr-space"> </span>
      </span>);
    last = p + 1;
  }
  out.push(piece.slice(last));
  return out;
}

/**
 * The headword's pronunciation. When both recordings exist the card offers 女 and 男 side by side, as the English
 * atlas offers 英 and 美.
 */
export function Pronounce({ entry, refw }: { entry: Entry; refw: WordRef | Entry }) {
  const atlas = useAtlas();
  const ipa = entry.uk || entry.us;
  const m = "media" in refw && typeof refw.media === "number" ? refw.media : (refw as Entry).m;
  const voices = (["uk", "us"] as const).filter((v) => m & MEDIA[v]);
  if (voices.length < 2)
    return (
      <div className="pron">
        <Speak url={atlas.audio(refw, "uk")} text={entry.w} size="sm" label={ipa ? <span className="ipa">{ipa}</span> : <em>朗读</em>} />
      </div>
    );
  return (
    <div className="pron">
      {voices.map((v) => (
        <Speak
          key={v}
          url={atlas.audio(refw, v)}
          text={entry.w}
          accent={v}
          size="sm"
          ariaLabel={`${VOICE_LABEL[v]}声朗读 ${entry.w}`}
          label={
            <>
              <em>{VOICE_LABEL[v]}</em>
              {v === "uk" && ipa && <span className="ipa">{ipa}</span>}
            </>
          }
        />
      ))}
    </div>
  );
}

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
  const voices = exampleVoices(entry, index);
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
  if (voices.length < 2) return <Speak url={index < 2 ? atlas.audio(entry, kind) : null} text={text} size="sm" className="ex-speak" />;
  return (
    <span className="ex-voices">
      {voices.map((v) => (
        <Speak key={v} url={atlas.audio(entry, kind, v)} text={text} accent={v} size="sm" ariaLabel={`${VOICE_LABEL[v]}声朗读例句`} label={<em>{VOICE_LABEL[v]}</em>} />
      ))}
    </span>
  );
}

export function EntryView({ entry, mode = "detail", eager = true }: { entry: Entry; mode?: "detail" | "intro" | "reveal"; eager?: boolean }) {
  const atlas = useAtlas();
  const ref = atlas.byId.get(entry.id);
  const card = useStore((s) => s.progress.cards[entry.id]);
  const saved = useStore((s) => s.progress.bookmarks.includes(entry.id));
  const topicIdx = atlas.topics.findIndex((t) => t[0] === entry.topic);
  const topic = atlas.topics[topicIdx];
  // a related word links to its entry only when it is in the lexicon itself
  const toLinks = (list: string[]) =>
    list.map((f) => {
      const w = f.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase();
      const hit = atlas.words.find((x) => x.word.toLowerCase() === w);
      return { label: f, id: hit?.id };
    });
  const famLinks = toLinks(entry.fam);
  const synLinks = toLinks(entry.syn);
  const antLinks = toLinks(entry.ant);
  const linkList = (links: { label: string; id?: string }[]) =>
    links.map((f) =>
      f.id && mode === "detail" ? (
        <button key={f.label} className="link" onClick={() => openWord(f.id!)}>
          {f.label}
        </button>
      ) : (
        <span key={f.label}>{f.label}</span>
      ),
    );
  const status = card ? (isMastered(card) ? "已掌握" : "学习中") : null;
  const mine = isCustomId(entry.id);
  const edited = useStore((s) => !!s.progress.edits?.[entry.id]);
  const autoFilled = useStore((s) => !!s.progress.custom?.[entry.id]?.auto);
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
            {edited && <span className="chip chip-mine">改过</span>}
            {autoFilled && (
              <span className="chip chip-status" title="由离线词典自动填写，还没有核对；编辑并保存一次即视为已核对">
                词典填写·待核对
              </span>
            )}
            {topic && <span className="chip">{topic[1]}</span>}
            {status && <span className={`chip chip-status ${status === "已掌握" ? "is-done" : ""}`}>{status}</span>}
          </div>
          {mode === "detail" && (
            <div className="entry-actions">
              <button className={`icon-btn ${editing ? "is-on" : ""}`} onClick={() => setEditing((v) => !v)} aria-pressed={editing} aria-label="编辑这个词" title={mine ? "编辑" : "改释义、加自己的例句"}>
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

        {editing && mode === "detail" && (
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
              </span>
              {s.en && (
                <span className="en" lang="fr">
                  {s.en}
                </span>
              )}
            </li>
          ))}
        </ol>

        {(mode === "detail" || mode === "intro") && <AiExplain key={entry.id} entry={entry} />}

        {entry.ex.length > 0 && (
          <section className="block">
            <h3 className="eyebrow">例句</h3>
            <ul className="examples">
              {entry.ex.map((x, i) => (
                <li key={i}>
                  {x.origin !== "supplement" && <span className={`ex-tag ${x.origin === "mine" || x.origin === "tatoeba" ? "is-mine" : ""}`}>{EX_TAG[x.origin ?? "book"]}</span>}
                  <p className="ex-en" lang="fr">
                    <Highlight text={x.en} word={entry.w} span={x.hl} />
                    <ExampleSpeak entry={entry} index={i} text={x.en} />
                  </p>
                  <p className="ex-zh">{x.zh}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {mode === "detail" && entry.senses[0]?.pos === "v." && <VerbConjugation id={entry.id} />}

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
                <p>{linkList(famLinks)}</p>
              </div>
            )}
            {entry.syn.length > 0 && (
              <div>
                <h3 className="eyebrow">近义</h3>
                <p>{linkList(synLinks)}</p>
              </div>
            )}
            {entry.ant.length > 0 && (
              <div>
                <h3 className="eyebrow">反义</h3>
                <p>{linkList(antLinks)}</p>
              </div>
            )}
          </section>
        )}

        <ConfusableBlock id={entry.id} />

        {entry.tip && (
          <aside className="tip">
            <Lightbulb size={17} strokeWidth={1.8} />
            <p>{entry.tip}</p>
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
  const hidden = useStore((s) => s.progress.hidden?.includes(id) ?? false);
  const [name, setName] = useState<string | null>(null);
  const mine = isCustomId(id);
  const rows: { id: string; name: string; on: boolean }[] = [
    ...(mine ? [] : [{ id: CORE_DECK, name: CORE_NAME, on: !hidden }]),
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
