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

/** Add natural speech pauses inside an already-trimmed French utterance. */
export function prosodyText(text: string, style: "radio" | "natural" = "radio"): string {
  let out = xmlEscape(text.trim());
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

/**
 * Multi-speaker SSML documents (split at `maxVoices` <voice> tags to stay safely below Azure's 50-voice cap).
 * Each turn gets its own voice, subtle prosody rate, and realistic turn-taking <break> pauses.
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
        const ratePct = style === "natural" ? SPEAKER_RATES[turn.who % SPEAKER_RATES.length] : 0;
        const gap = k === 0 ? "" : `<break time="${style === "natural" && INTERRUPT_START.test(turn.t.trim()) ? "80ms" : style === "natural" ? "240ms" : "380ms"}"/>`;
        const inner = `<prosody rate="${pct(ratePct)}" pitch="+0%">${prosodyText(turn.t, style)}</prosody>`;
        return `${gap}${wrapVoice(voice, inner)}`;
      })
      .join("");
    batches.push(`<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">${body}</speak>`);
  }
  return batches;
}
