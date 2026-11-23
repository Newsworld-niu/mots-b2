import { ERROR_TYPES } from "../../lib/writing";

export const str = { type: "string" };

export const SCORE_LEVEL_SCHEMA = { type: "number", enum: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] };

export const pairItems = (a: string, b: string) => ({
  type: "array",
  items: { type: "object", properties: { [a]: str, [b]: str }, required: [a, b], additionalProperties: false },
});

export const CORRECTIONS_ARRAY_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { wrong: str, right: str, type: { type: "string", enum: [...ERROR_TYPES] }, why: str, point: str },
    required: ["wrong", "right", "type", "why", "point"],
    additionalProperties: false,
  },
};

/** The levels and linguistic criteria shared by the official FEI Sept-2022 writing and speaking grids, in the marker's words. */
export const GRID_LEVELS = `Each criterion gets a half-point mark from 0 to 5 on the official FEI Sept-2022 DELF B2 0.5-pt scale (0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5):
- 0 = insuffisant / nothing assessable or off-topic;
- 0.5–2.5 = below B2 (<B2): 0.5 = A2/minimal fragment; 1–1.5 = clearly B1 (elementary repertoire, recurring errors or incomplete argumentation); 2 = B1+ approaching B2; 2.5 = borderline B2 (right intent, but uneven consistency or control);
- 3–4 = at the target DELF B2 band: 3 = solid B2 (meets DELF B2 requirements cleanly; 15/25 is a solid B2 pass, NOT 25/25); 3.5 = good B2 (confident B2 with clear examples/variety); 4 = strong B2 (~20/25, nuanced control with only isolated minor slips);
- 4.5–5 = B2+/C1: 4.5 = upper B2+ with idiomatic precision; 5 = C1-adjacent excellence, clearly surpassing B2 in organic cohesion, register, idiomatic lexis, and virtually error-free syntax.
CRITICAL CALIBRATION RULE: Score each criterion INDEPENDENTLY using 0.5-pt steps — real learners almost always have jagged profiles (e.g. strong memorized structure/register 3.5 with B1-leaning lexis/morpho 1.5–2, or rich ideas 4 with weak register 1). Never flatten an uneven script to uniform 3/3/3/3/3, and never award 4.5–5 merely for fulfilling the prompt cleanly. Use the same standards every time: the same production must get the same marks.`;

export const GRID_LANGUAGE = `- "lexique": 0.5–1.5 = repetitive basic words/modifiers ("très bon", "très mauvais", "très cher", "très utile", "beaucoup de", "des choses", "problème"), wrong comparatives ("plus bon"), vague spoken words ("ça", "les gens"), or calques ("sur le journal", "très d'accord"); 2–2.5 = attempts topic vocabulary beyond basic B1, yet still relies noticeably on safe/generic terms or awkward collocations (2 = B1+, 2.5 = borderline B2); 3–3.5 = solid topic-appropriate B2 vocabulary and collocations, uses synonyms/paraphrase to avoid repetition, occasional slips that do not obscure meaning (3 = solid B2, 3.5 = good varied B2); 4 = varied, precise B2 collocations and idiomatic phrasing with very few slips; 4.5–5 = rich, idiomatic B2+/C1 repertoire with precise collocations and virtually zero lexical/spelling slips.
- "morpho": 0.5–1.5 = handles simple clauses and basic tenses, but makes systematic B1 errors in articles/partitives ("beaucoup des", "de le"), gender/number agreement ("un grande"), prepositions ("difficile pour"), or fails required complex structures (indicative instead of subjunctive after "il faut que"/"bien que", broken "si" clauses); 2–2.5 = mixes B2 structures with recurring non-systematic grammar/agreement/preposition slips that weaken accuracy; 3–3.5 = solid B2 control of conditionals, subjunctives, and relatives with only minor non-systematic slips (if ANY clear grammar/agreement error exists, morpho CANNOT be 5); 4 = strong, confident control of complex B2 syntax across the text with at most 1 tiny slip; 4.5–5 = virtually zero errors across varied B2+/C1 structures.`;
