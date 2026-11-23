import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analyzeLiaisons,
  classifyWordBoundaryLiaison,
  isHAspire,
  liaisonPoints,
  startsVowelSound,
} from "./liaison.ts";

/** The sentence with ‿ at every obligatory liaison point, for readable assertions. */
const mark = (s: string) => {
  const pts = new Set(liaisonPoints(s));
  return [...s].map((c, i) => (pts.has(i) ? "‿" : c)).join("");
};

test("determiners, pronouns, prepositions and prenominal adjectives link with expected IPA consonants (/z, n, t, ʁ, v/)", () => {
  assert.equal(mark("Les enfants ont des amis."), "Les‿enfants ont des‿amis.");
  assert.equal(mark("Nous avons un ami."), "Nous‿avons un‿ami.");
  assert.equal(mark("Ils habitent en Italie."), "Ils‿habitent en‿Italie.");
  assert.equal(mark("Elle a deux heures et six ans."), "Elle a deux‿heures et six‿ans.");
  assert.equal(mark("Qu'ils y aillent."), "Qu'ils‿y aillent.");

  assert.deepEqual(classifyWordBoundaryLiaison("les", "amis"), {
    left: "les",
    right: "amis",
    kind: "obligatory",
    consonant: "z",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("un", "ami"), {
    left: "un",
    right: "ami",
    kind: "obligatory",
    consonant: "n",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("grand", "homme"), {
    left: "grand",
    right: "homme",
    kind: "obligatory",
    consonant: "t",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("quand", "on"), {
    left: "quand",
    right: "on",
    kind: "obligatory",
    consonant: "t",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("premier", "étage"), {
    left: "premier",
    right: "étage",
    kind: "obligatory",
    consonant: "ʁ",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("neuf", "ans"), {
    left: "neuf",
    right: "ans",
    kind: "obligatory",
    consonant: "v",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("neuf", "heures"), {
    left: "neuf",
    right: "heures",
    kind: "obligatory",
    consonant: "v",
  });
});

test("comprehensive h aspiré vs h muet stem and word coverage", () => {
  const hAspireWords = [
    "héros",
    "hausse",
    "hausses",
    "harcèlement",
    "harceler",
    "hasard",
    "haine",
    "handicap",
    "handicapés",
    "hiérarchie",
    "huit",
    "honte",
    "hors",
    "haut",
    "haute",
    "heurter",
    "hurler",
    "hâte",
    "haie",
    "hache",
    "hibou",
    "homard",
    "hall",
    "hameau",
    "hanche",
    "hangar",
    "hareng",
    "haricot",
    "harpe",
    "hochet",
    "Hollande",
    "Hongrie",
    "houle",
    "housse",
    "hublot",
    "huée",
  ];
  for (const w of hAspireWords) {
    assert.equal(isHAspire(w), true, `expected h aspiré for ${w}`);
    assert.equal(startsVowelSound(w), false, `expected startsVowelSound=false for ${w}`);
  }

  const hMuetWords = ["héroïne", "héroïnes", "héroïque", "héroïsme", "homme", "habitude", "hypothèse", "histoire", "heure"];
  for (const w of hMuetWords) {
    assert.equal(isHAspire(w), false, `expected h muet for ${w}`);
    assert.equal(startsVowelSound(w), true, `expected startsVowelSound=true for ${w}`);
  }
  assert.equal(mark("Les héroïnes ont un héroïsme rare."), "Les‿héroïnes ont un‿héroïsme rare.");
});

test("no obligatory mark and explicit forbidden liaison sites (et, h aspiré, singular noun, inverted pronoun, onze)", () => {
  assert.equal(mark("Les héros sont là."), "Les héros sont là.", "h aspiré");
  assert.equal(mark("Vous et moi."), "Vous et moi.");
  assert.equal(mark("L'un et l'autre."), "L'un et l'autre.");
  assert.equal(mark("Vous, avez-vous un stylo ?"), "Vous, avez-vous un stylo ?");
  assert.equal(mark("Ont-ils une voiture ?"), "Ont-ils une voiture ?");
  assert.equal(mark("Les onze joueurs."), "Les onze joueurs.");
  assert.equal(mark("Vous aussi."), "Vous aussi.");
  assert.equal(mark("Quelqu'un est venu."), "Quelqu'un est venu.");

  // Forbidden after `et`
  assert.deepEqual(classifyWordBoundaryLiaison("et", "il"), {
    left: "et",
    right: "il",
    kind: "forbidden",
    consonant: "t",
    reason: "after_et",
  });

  // Forbidden before *h aspiré* and `onze`
  assert.deepEqual(classifyWordBoundaryLiaison("les", "héros"), {
    left: "les",
    right: "héros",
    kind: "forbidden",
    consonant: "z",
    reason: "before_h_aspire",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("en", "hausse"), {
    left: "en",
    right: "hausse",
    kind: "forbidden",
    consonant: "n",
    reason: "before_h_aspire",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("les", "onze"), {
    left: "les",
    right: "onze",
    kind: "forbidden",
    consonant: "z",
    reason: "no_liaison_word",
  });

  // Forbidden after singular nouns before vowels
  assert.deepEqual(classifyWordBoundaryLiaison("étudiant", "intelligent", "un"), {
    left: "étudiant",
    right: "intelligent",
    kind: "forbidden",
    consonant: "t",
    reason: "singular_noun",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("pays", "ouvert", "un"), {
    left: "pays",
    right: "ouvert",
    kind: "forbidden",
    consonant: "z",
    reason: "singular_noun",
  });
  assert.deepEqual(classifyWordBoundaryLiaison("gouvernement", "a"), {
    left: "gouvernement",
    right: "a",
    kind: "forbidden",
    consonant: "t",
    reason: "singular_noun",
  });
  // Plural noun (`des pays ouverts`) is optional liaison, NOT forbidden singular noun
  assert.equal(classifyWordBoundaryLiaison("pays", "ouverts", "des"), null);
  // Natural enchaînement (`un fils unique`) has pronounced final consonant, NOT forbidden liaison
  assert.equal(classifyWordBoundaryLiaison("fils", "unique", "un"), null);

  // Inverted subject pronoun (`ont-ils une`)
  const sites = analyzeLiaisons("Les héros et un étudiant intelligent ont-ils une idée ?");
  assert.deepEqual(
    sites.map((s) => [s.left, s.right, s.kind, s.reason ?? ""]),
    [
      ["les", "héros", "forbidden", "before_h_aspire"],
      ["et", "un", "forbidden", "after_et"],
      ["un", "étudiant", "obligatory", ""],
      ["étudiant", "intelligent", "forbidden", "singular_noun"],
      ["ont-ils", "une", "forbidden", "inverted_pronoun"],
    ],
  );
});
