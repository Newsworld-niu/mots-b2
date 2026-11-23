import assert from "node:assert/strict";
import { test } from "node:test";
import { TENSES } from "./conjugation.ts";
import { checkContextConjugation, CONTEXT_CONJ_ITEMS } from "./conj-context.ts";

test("Wave7.3 + M1B: contextual conjugation dataset covers all 12 tenses + B2 triggers with contrastive diacritic verdicts", () => {
  assert.ok(CONTEXT_CONJ_ITEMS.length >= 30, `expected >= 30 items, got ${CONTEXT_CONJ_ITEMS.length}`);
  const byTense = new Map<string, number>();
  const seen = new Set<string>();
  for (const item of CONTEXT_CONJ_ITEMS) {
    assert.ok(!seen.has(item.id), `duplicate id ${item.id}`);
    seen.add(item.id);
    assert.ok(item.tenseChoices.includes(item.tense), `${item.id} choices missing answer tense`);
    assert.equal(item.tenseChoices.length, 4);
    byTense.set(item.tense, (byTense.get(item.tense) ?? 0) + 1);
  }
  for (const t of TENSES) {
    assert.ok((byTense.get(t) ?? 0) >= 2, `tense ${t} needs >= 2 contextual items`);
  }

  const condpItem = CONTEXT_CONJ_ITEMS.find((x) => x.id === "cc-condp-1")!;
  assert.deepEqual(checkContextConjugation(condpItem, "condp", "aurait dû"), {
    tenseOk: true,
    formOk: true,
    accentOnly: false,
    canonical: "aurait dû",
    orthographyHint: null,
  });
  // Grammatical homophone dû vs du is strictly rejected as wrong (not excused as accentOnly)
  const homophoneErr = checkContextConjugation(condpItem, "condp", "aurait du");
  assert.equal(homophoneErr.tenseOk, true);
  assert.equal(homophoneErr.formOk, false);
  assert.equal(homophoneErr.accentOnly, false);
  assert.ok(homophoneErr.orthographyHint);

  // Pure lexical stem accent slip (detourné vs détourné, keeping -é participle ending) is flagged accentOnly
  const journItem = CONTEXT_CONJ_ITEMS.find((x) => x.id === "cc-b2-journ-condp")!;
  const stemAccentSlip = checkContextConjugation(journItem, "condp", "auraient detourné");
  assert.equal(stemAccentSlip.tenseOk, true);
  assert.equal(stemAccentSlip.formOk, false);
  assert.equal(stemAccentSlip.accentOnly, true);

  const wrongTense = checkContextConjugation(condpItem, "cond", "aurait dû");
  assert.equal(wrongTense.tenseOk, false);
  assert.equal(wrongTense.formOk, true);
});
