/**
 * SSML builders for Azure AI Speech: natural pauses (<break>) and per-speaker pacing (<prosody>),
 * plus whole-passage multi-speaker <voice> documents so radio interviews play without chunk gaps.
 */

export interface SsmlOptions {
  style?: "radio" | "natural";
  ratePct?: number;
  pitchPct?: number;
}

export const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

const pct = (n: number) => `${n >= 0 ? "+" : ""}${Math.round(n)}%`;

const ROMAN_CARDINALS: Record<string, string> = {
  II: "deux",
  III: "trois",
  IV: "quatre",
  V: "cinq",
  VI: "six",
  VII: "sept",
  VIII: "huit",
  IX: "neuf",
  X: "dix",
  XI: "onze",
  XII: "douze",
  XIII: "treize",
  XIV: "quatorze",
  XV: "quinze",
  XVI: "seize",
  XXIII: "vingt-trois",
};

const CENTURY_ORDINALS: Record<string, string> = {
  XVI: "seizième",
  XVII: "dix-septième",
  XVIII: "dix-huitième",
  XIX: "dix-neuvième",
  XX: "vingtième",
  XXI: "vingt et unième",
};

/**
 * Guard tricky French idioms, silent-consonant homographs, Roman numerals, and symbols
 * with `<sub alias="...">` so Azure neural voices never misread e.g. `bât` in `le bât blesse`.
 */
export function applyFrenchPronunciationGuards(escaped: string): string {
  let out = escaped;
  // "le bât blesse" -> silent final -t ("ba", never "batte")
  out = out.replace(/\b(le\s+)bât(\s+blesse)\b/gi, (_, a: string, b: string) => {
    const art = /^[A-Z]/.test(a) ? "Le " : "le ";
    return `<sub alias="${art}ba blesse">${a}bât${b}</sub>`;
  });
  // "plus d'un(e)" -> silent -s ("plu d'un")
  out = out.replace(/\bplus\s+d(&apos;|’)un(e)?\b/gi, (m, _ap: string, fem?: string) => `<sub alias="plu d&apos;un${fem ?? ""}">${m}</sub>`);
  // Roman centuries ("XXe", "XXIe", "XXᵉ")
  out = out.replace(/\b(XXI|XX|XIX|XVIII|XVII|XVI)(?:e|ᵉ)\b/g, (m, rom: string) => `<sub alias="${CENTURY_ORDINALS[rom]}">${m}</sub>`);
  // Sovereign / Pope Roman numerals ("Charles III", "Léon XIV", "Louis XVI", "François Ier")
  out = out.replace(
    /\b(Charles|Léon|Louis|Henri|François|Jean-Paul|Benoît|Pie)\s+(I(?:er|ᵉʳ)|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XXIII)\b/g,
    (_m, name: string, rom: string) => {
      const spoken = /^I(?:er|ᵉʳ)$/.test(rom) ? "premier" : ROMAN_CARDINALS[rom] ?? rom;
      return `${name} <sub alias="${spoken}">${rom}</sub>`;
    },
  );
  // Abbreviated French ordinals ("1er", "1ᵉʳ", "1re", "1ʳᵉ")
  out = out.replace(/\b1(?:er|ᵉʳ)\b/g, (m) => `<sub alias="premier">${m}</sub>`);
  out = out.replace(/\b1(?:re|ʳᵉ)\b/g, (m) => `<sub alias="première">${m}</sub>`);
  // Percentage symbol
  out = out.replace(/(\d)\s*%/g, `$1 <sub alias="pour cent">%</sub>`);
  return out;
}

/** Add natural speech pauses inside an already-trimmed French utterance. */
export function prosodyText(text: string, style: "radio" | "natural" = "radio"): string {
  let out = applyFrenchPronunciationGuards(xmlEscape(text.trim()));
  const sentencePause = style === "natural" ? "260ms" : "340ms";
  const ellipsisPause = style === "natural" ? "260ms" : "200ms";
  // Ellipses and hesitant restarts ("on a… enfin")
  out = out.replace(/(?:\.\.\.|…)\s*/g, `…<break time="${ellipsisPause}"/> `);
  // Oral fillers in conversational French
  if (style === "natural") {
    out = out.replace(/\b(euh|ben|bah|bon|enfin|voilà|du coup)\b([,;]?)\s+/gi, `$1$2 <break time="140ms"/> `);
  }
  // Semicolons / dashes
  out = out.replace(/([;—–])\s+/g, `$1 <break time="160ms"/> `);
  // Sentence boundaries (when followed by more text)
  out = out.replace(/([.!?]["»”)]*)\s+(?=[^\s])/g, `$1<break time="${sentencePause}"/> `);
  return out.trim();
}

function wrapVoice(voice: string, inner: string): string {
  const lang = voice.match(/^[a-z]{2}-[A-Z]{2}/)?.[0] ?? "fr-FR";
  const body = lang.startsWith("fr-") ? inner : `<lang xml:lang="fr-FR">${inner}</lang>`;
  return `<voice name="${xmlEscape(voice)}">${body}</voice>`;
}

/** Single-speaker SSML with <prosody> and <break> cues. */
export function buildVoiceSsml(text: string, voice: string, opts: SsmlOptions = {}): string {
  const style = opts.style ?? "radio";
  const lang = voice.match(/^[a-z]{2}-[A-Z]{2}/)?.[0] ?? "fr-FR";
  const rate = pct(opts.ratePct ?? 0);
  const pitch = pct(opts.pitchPct ?? 0);
  const inner = `<prosody rate="${rate}" pitch="${pitch}">${prosodyText(text, style)}</prosody>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">${wrapVoice(voice, inner)}</speak>`;
}

const INTERRUPT_START = /^(?:Pardon|Justement|Mais|Attendez|Excusez-moi|Tout à fait|Exactement|Oui,\s*mais|Non,\s*mais)\b/i;
const SPEAKER_RATES = [0, 3, -2, 4] as const;
const SPEAKER_RADIO_RATES = [0, 2, -2, 3] as const;
const SPEAKER_PITCHES = [0, -2, 2, -3] as const;

/**
 * Multi-speaker SSML documents (split at `maxVoices` <voice> tags to stay safely below Azure's 50-voice cap).
 * Each turn gets its own voice, distinct speaker rate/pitch contour, and realistic turn-taking <break> pauses.
 */
export function buildDialogueSsmlBatches(
  turns: { t: string; who: number }[],
  voices: string[],
  opts: { style?: "radio" | "natural" } = {},
  maxVoices = 40,
): string[] {
  const cleanTurns = turns.filter((t) => t.t.trim());
  if (!cleanTurns.length || !voices.length) return [];
  const style = opts.style ?? "radio";
  const batches: string[] = [];
  for (let start = 0; start < cleanTurns.length; start += maxVoices) {
    const slice = cleanTurns.slice(start, start + maxVoices);
    const body = slice
      .map((turn, k) => {
        const voice = voices[turn.who % voices.length];
        const ratePct = style === "natural" ? SPEAKER_RATES[turn.who % SPEAKER_RATES.length] : SPEAKER_RADIO_RATES[turn.who % SPEAKER_RADIO_RATES.length];
        const pitchPct = SPEAKER_PITCHES[turn.who % SPEAKER_PITCHES.length];
        const gap = k === 0 ? "" : `<break time="${style === "natural" && INTERRUPT_START.test(turn.t.trim()) ? "80ms" : style === "natural" ? "240ms" : "380ms"}"/>`;
        const inner = `<prosody rate="${pct(ratePct)}" pitch="${pct(pitchPct)}">${prosodyText(turn.t, style)}</prosody>`;
        return wrapVoice(voice, `${gap}${inner}`);
      })
      .join("");
    batches.push(`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">${body}</speak>`);
  }
  return batches;
}
