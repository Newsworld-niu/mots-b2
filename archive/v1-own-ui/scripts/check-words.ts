/* Structural checks for the B2 dataset. Run: npm run check:words */
import { WORDS } from "../src/data/words.ts";
import { TOPICS } from "../src/data/topics.ts";
import { clozeOf } from "../src/lib/fr.ts";

const errors: string[] = [];
const ids = new Set<string>();
const topicKeys = new Set(TOPICS.map((t) => t.key));

for (const w of WORDS) {
  const where = `[${w.id}]`;
  if (!/^[a-z0-9-]+$/.test(w.id)) errors.push(`${where} id must be ASCII slug`);
  if (ids.has(w.id)) errors.push(`${where} duplicate id`);
  ids.add(w.id);
  if (!topicKeys.has(w.topic)) errors.push(`${where} unknown topic ${w.topic}`);
  if (w.cefr !== "B2") errors.push(`${where} cefr must be B2`);
  if (!w.senses.length || w.senses.length > 3) errors.push(`${where} needs 1–3 senses`);
  for (const s of w.senses) {
    if (!s.pos || !s.zh || !s.fr) errors.push(`${where} sense missing pos/zh/fr`);
  }
  if (w.ex.length !== 2) errors.push(`${where} needs exactly 2 examples`);
  for (const e of w.ex) {
    if (!e.fr || !e.zh) errors.push(`${where} example missing fr/zh`);
    if (!clozeOf(e.fr, w.w)) errors.push(`${where} example does not contain headword stem: "${e.fr}"`);
  }
  if (w.col.length < 2) errors.push(`${where} needs ≥2 collocations`);
  for (const c of w.col) if (!c.includes("｜")) errors.push(`${where} collocation must use "fr｜zh": ${c}`);
  if (!w.tip) errors.push(`${where} missing tip`);
}

for (const t of TOPICS) {
  const n = WORDS.filter((w) => w.topic === t.key).length;
  if (n === 0) errors.push(`topic ${t.key} has no words`);
}

const perTopic = TOPICS.map((t) => `${t.key}=${WORDS.filter((w) => w.topic === t.key).length}`).join(" ");
console.log(`words: ${WORDS.length}  topics: ${TOPICS.length}  ${perTopic}`);
if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`FAIL: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log("OK: all structural checks passed");
