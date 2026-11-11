/**
 * French pronunciation via the browser's built-in speech synthesis.
 * No audio files are shipped: the site relies on the system's fr-FR voice when one exists.
 */

let frVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => /^fr[-_]FR$/i.test(v.lang) && /amélie|thomas|audrey|marie|google/i.test(v.name)) ??
    voices.find((v) => /^fr[-_]FR$/i.test(v.lang)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith("fr")) ??
    null
  );
}

/** True when the browser exposes at least one French voice (may be false on bare Linux/Android). */
export function frenchVoiceAvailable() {
  if (frVoice === undefined) frVoice = pickVoice();
  if (typeof speechSynthesis !== "undefined" && !frVoice) {
    speechSynthesis.addEventListener?.("voiceschanged", () => (frVoice = pickVoice()), { once: true });
  }
  return !!frVoice;
}

export function speakFr(text: string, rate = 0.9): boolean {
  if (typeof speechSynthesis === "undefined") return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = rate;
  frVoice = frVoice ?? pickVoice();
  if (frVoice) u.voice = frVoice;
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeech() {
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}
