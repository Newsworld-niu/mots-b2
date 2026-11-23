/**
 * French obligatory & forbidden liaison (联诵 / 禁忌联诵) + *h aspiré* phonological engine.
 * Provides character-offset obligatory liaison markers for reading cards (`liaisonPoints`) as well as
 * word-boundary classification (`classifyWordBoundaryLiaison`, `analyzeLiaisons`) with expected IPA
 * consonants (`/z, n, t, ʁ, v/`) and *liaison interdite* detection (after `et`, before *h aspiré*,
 * after singular nouns before vowels, and after inverted pronouns).
 */

export type LiaisonConsonant = "z" | "n" | "t" | "ʁ" | "v";
export type LiaisonKind = "obligatory" | "forbidden";
export type ForbiddenLiaisonReason =
  | "after_et"
  | "before_h_aspire"
  | "singular_noun"
  | "inverted_pronoun"
  | "no_liaison_word";

export interface LiaisonSite {
  /** Character index of the space in the source string (or -1 when classified from bare word tokens). */
  index: number;
  /** Index `i` of the left word token in `[words[i], words[i + 1]]`. */
  wordIndex: number;
  left: string;
  right: string;
  kind: LiaisonKind;
  /** Expected IPA consonant for obligatory liaisons, or false intruding consonant for forbidden liaisons. */
  consonant: LiaisonConsonant;
  reason?: ForbiddenLiaisonReason;
}

/** Determiners, possessives, numerals and quantifiers mapping to their obligatory liaison consonant. */
const DETERMINER_CONSONANT: Record<string, LiaisonConsonant> = {
  les: "z",
  des: "z",
  ces: "z",
  mes: "z",
  tes: "z",
  ses: "z",
  nos: "z",
  vos: "z",
  leurs: "z",
  aux: "z",
  deux: "z",
  trois: "z",
  six: "z",
  dix: "z",
  plusieurs: "z",
  quels: "z",
  quelles: "z",
  quelques: "z",
  certains: "z",
  certaines: "z",
  tous: "z",
  un: "n",
  aucun: "n",
  mon: "n",
  ton: "n",
  son: "n",
  tout: "t",
  vingt: "t",
  cent: "t",
};

/** Subject / object clitic pronouns mapping to their obligatory liaison consonant before a verb or y / en. */
const PRONOUN_CONSONANT: Record<string, LiaisonConsonant> = {
  nous: "z",
  vous: "z",
  ils: "z",
  elles: "z",
  on: "n",
  en: "n",
};

/** Monosyllabic prepositions and degree adverbs that obligatorily link to a following vowel-initial word. */
const PREP_ADV_CONSONANT: Record<string, LiaisonConsonant> = {
  dans: "z",
  chez: "z",
  sans: "z",
  sous: "z",
  très: "z",
  en: "n",
};

/** Common prenominal adjectives with obligatory liaison before a vowel-initial noun. */
const PRENOMINAL_ADJ_CONSONANT: Record<string, LiaisonConsonant> = {
  petit: "t",
  petits: "z",
  petites: "z",
  grand: "t",
  grands: "z",
  grandes: "z",
  bon: "n",
  bons: "z",
  mauvais: "z",
  ancien: "n",
  anciens: "z",
  premier: "ʁ",
  premiers: "z",
  dernier: "ʁ",
  derniers: "z",
  léger: "ʁ",
  légers: "z",
  second: "t",
  seconds: "z",
  autres: "z",
  mêmes: "z",
  beaux: "z",
  nouveaux: "z",
  vieux: "z",
  gros: "z",
  faux: "z",
};

/** After a subject pronoun these words are not finite verbs: no required liaison (vous‿et is wrong, vous aussi is optional). */
const NOT_AFTER_PRONOUN = new Set([
  "et", "ou", "aussi", "à", "au", "aux", "avec", "alors", "après", "encore",
  "ici", "ainsi", "autant", "autrement", "un", "une", "oui", "onze",
]);

/** Mute-h derivatives of `héros` that DO take liaison (`l'héroïne`, `les‿héroïnes`), unlike `le héros` (`les | héros`). */
const MUTE_HERO_DERIVATIVES = /^héroï(ne|nes|que|ques|quement|sme|smes)$/;

/**
 * Comprehensive French *h aspiré* word & stem patterns (no elision, no liaison: `les | héros`, `en | hausse`,
 * `le | harcèlement`, `au | hasard`, `la | haine`, `un | handicap`, `la | hiérarchie`, `les | huit`, etc.).
 */
const H_ASPIRE_EXACT = new Set([
  "héros", "hors", "huit", "huitième", "huitièmes", "huitaine",
  "haie", "haies", "hall", "halls", "halle", "halles", "halte", "haltes",
  "hamac", "hamacs", "hameau", "hameaux", "hanche", "hanches", "hangar", "hangars",
  "haras", "hardes", "hareng", "harengs", "haricot", "haricots", "harnais",
  "harpe", "harpes", "harpiste", "harpistes", "havre", "havres", "hêtre", "hêtres",
  "heur", "hibou", "hiboux", "hic", "hobby", "hobbies", "hochet", "hochets",
  "hockey", "holding", "holdings", "homard", "homards", "honte", "hontes", "honteux", "honteuse", "honteuses",
  "hoquet", "hoquets", "horde", "hordes", "hotte", "hottes", "houblon", "houille",
  "houle", "houles", "houleux", "houleuse", "houppe", "hourra", "housse", "housses",
  "hub", "hubs", "hublot", "hublots", "huée", "huées", "huer", "huguenot", "huguenots",
  "hune", "hunes", "huppe", "huppé", "huppée", "huppés", "huppées", "hure",
  "husky", "hussard", "hussards", "hutte", "huttes", "handball",
]);

const H_ASPIRE_STEM_RE =
  /^(hauss|harcèl|harcel|hasard|hain|haïr|haïss|hais$|hait$|handicap|hiérarch|haut|heurt|hurl|hât|hach|hocher|holland|hongr|halet|hamburg|hamster|hant|happ|harang|hardi|harem|hargn|harpon|hasch|henni|hériss|hernie|héron|herse|hideu|hippi|hiss|honni|houspill|hulul|humer)/;

/** Vowel/glide-initial words that block liaison like *h aspiré* (`les | onze`, `mais | oui`, `des | yaourts`). */
const NO_LIAISON_WORDS = new Set([
  "onze", "onzième", "onzièmes", "oui", "ouate", "ouistiti", "uhlan",
  "yacht", "yachts", "yaourt", "yaourts", "yoga", "yougoslave", "yéti",
]);

/** Little conjunctions/prepositions that never receive liaison from a preceding word (`l'un | et`, `un | à`). */
const NO_OBLIGATORY_RIGHT = new Set(["et", "ou", "à"]);

const VOWEL = /^[aeiouâàäéèêëîïôöûùüœæ]/;

const cleanRightToken = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/^[«"“'’([{#]+/, "")
    .replace(/[-'’].*$/, "")
    .replace(/[^a-zà-ÿœæ]+$/, "");

const cleanLeftToken = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/^[«"“([{#]+/, "")
    .replace(/[^a-zà-ÿœæ'’-]+$/, "");

/** True when `word` begins with French *h aspiré* (blocks elision and forbids liaison). */
export function isHAspire(word: string): boolean {
  const w = cleanRightToken(word);
  if (!w.startsWith("h")) return false;
  if (MUTE_HERO_DERIVATIVES.test(w)) return false;
  return H_ASPIRE_EXACT.has(w) || H_ASPIRE_STEM_RE.test(w);
}

/** True when `w` (already cleaned, lowercase) starts with a French vowel sound that accepts liaison. */
export function startsVowelSound(word: string): boolean {
  const w = cleanRightToken(word);
  if (!w || NO_LIAISON_WORDS.has(w) || NO_OBLIGATORY_RIGHT.has(w)) return false;
  if (w === "y" || w === "yeux") return true;
  if (w.startsWith("h")) return !isHAspire(w) && w.length > 1;
  return VOWEL.test(w);
}

/** True when `w` begins acoustically with a vowel (including `et`, `ou`, `à`, *h aspiré*, `onze`, `huit`). */
function startsAcousticVowelOrGlide(word: string): boolean {
  const w = cleanRightToken(word);
  if (!w) return false;
  if (w === "y" || w === "yeux" || w === "huit" || w === "huitième") return true;
  if (w.startsWith("h")) return w.length > 1;
  return VOWEL.test(w);
}

/** Singular determiners indicating the following noun is singular. */
const SINGULAR_DETERMINERS = new Set([
  "un", "une", "le", "la", "ce", "cet", "cette", "mon", "ton", "son",
  "notre", "votre", "leur", "chaque", "aucun", "aucune", "quel", "quelle", "du", "au",
]);

/** Words that can follow a singular determiner without being the head noun (adverbs / prenominal adjectives). */
const NON_NOUN_AFTER_SING_DET = new Set([
  "très", "plus", "moins", "trop", "bien", "assez", "fort", "si", "tout", "toute", "même", "autre",
  "petit", "petite", "grand", "grande", "bon", "bonne", "mauvais", "mauvaise", "ancien", "ancienne",
  "nouveau", "nouvel", "nouvelle", "beau", "bel", "belle", "vieux", "vieil", "vieille",
  "premier", "première", "dernier", "dernière", "second", "seconde", "jeune", "joli", "jolie",
  "gros", "grosse", "long", "longue", "haut", "haute", "court", "courte", "faux", "fausse",
  "seul", "seule", "certain", "certaine", "tel", "telle", "double", "demi",
]);

/** Singular words whose final consonant IS naturally pronounced (enchaînement, NOT forbidden liaison). */
const PRONOUNCED_FINAL_CONSONANT = new Set([
  "sens", "fils", "bus", "virus", "bonus", "campus", "cursus", "processus", "consensus", "blocus", "tonus", "lapsus",
  "maïs", "oasis", "tennis", "ours", "mars", "gaz", "sud", "est", "ouest", "sept", "huit", "concept", "impact",
  "contact", "direct", "strict", "exact", "correct", "test", "net", "brut", "dot",
]);

/** Unambiguous singular nouns (morphologically singular, non-verb homographs) ending in a silent `-t`, `-d`, or nasal `-n`. */
const UNAMBIGUOUS_SINGULAR_NOUN_RE =
  /^(étudiant|habitant|enfant|enseignant|client|commerçant|dirigeant|participant|adolescent|président|parent|agent|continent|argent|talent|gouvernement|parlement|environnement|développement|changement|logement|enseignement|harcèlement|financement|fonctionnement|comportement|mouvement|événement|élément|document|monument|médicament|instrument|vêtement|appartement|département|établissement|investissement|réchauffement|vieillissement|isolement|épuisement|encadrement|règlement|traitement|jugement|sentiment|argument|moment|aliment|bâtiment|sujet|projet|budget|objet|effet|secret|intérêt|respect|débat|état|résultat|climat|candidat|contrat|syndicat|constat|achat|droit|produit|esprit|conflit|profit|statut|institut|début|mot|impôt|défaut|goût|art|départ|retard|rapport|transport|sport|effort|confort|accord|nord|hasard|regard|standard|milliard|citoyen|moyen|besoin|plan|bilan|écran|roman|océan|quotidien|examen|chemin|jardin|matin|voisin|médecin|scrutin|terrain|frein|soin|témoin|emploi.*|question|solution|situation|éducation|pollution|consommation|information|génération|population|tradition|décision|pression|émission|opinion|réflexion|transition|réduction|protection|création|formation|condition|attention|intention|action|mesure|danger|métier|quartier|papier|cahier|dossier|chantier|foyer|loyer|courrier|calendrier|ouvrier|policier|infirmier|étranger|passager|usager)$/;

/** Map the silent final spelling of a word to the liaison consonant that would surface if wrongly linked. */
function latentFinalConsonant(word: string): LiaisonConsonant | null {
  if (PRONOUNCED_FINAL_CONSONANT.has(word)) return null;
  if (/[sxz]$/.test(word)) return "z";
  if (/[td]$/.test(word)) return "t";
  if (/(?:ion|on|an|en|in|ain|ein|oin|un)$/.test(word)) return "n";
  if (word.length >= 5 && /er$/.test(word) && !/^(?:mer|fer|ver|hier|cher|fier|amer|hiver|enfer|cancer|super|leader|master|poster|scanner|starter|transfer)$/.test(word)) {
    return "ʁ";
  }
  return null;
}

function isSingularNounWithSilentFinal(left: string, prevClean?: string): LiaisonConsonant | null {
  if (!left || left === "et" || DETERMINER_CONSONANT[left] || PRONOUN_CONSONANT[left] || PREP_ADV_CONSONANT[left]) {
    return null;
  }
  if (NON_NOUN_AFTER_SING_DET.has(left)) return null;
  const c = latentFinalConsonant(left);
  if (!c) return null;
  const prevBase = prevClean ? prevClean.replace(/^.*['’]/, "") : "";
  const afterSingDet =
    (prevBase !== "" && SINGULAR_DETERMINERS.has(prevBase)) ||
    (prevClean !== undefined && /^(?:l|d)['’]$/.test(prevClean));
  if (afterSingDet) return c;
  // Without a visible singular determiner, never guess on -s/-x words (could be plural); rely on unambiguous singular stems
  if (c === "z") return null;
  if (UNAMBIGUOUS_SINGULAR_NOUN_RE.test(left) && !left.endsWith("emploi")) return c;
  return null;
}

/**
 * Classify the liaison relationship across an adjacent French word pair `(leftRaw, rightRaw)`
 * (optionally with `prevRaw` at `i - 1` to disambiguate singular nouns like `un pays ouvert`).
 */
export function classifyWordBoundaryLiaison(
  leftRaw: string,
  rightRaw: string,
  prevRaw?: string,
): Omit<LiaisonSite, "index" | "wordIndex"> | null {
  const leftFull = cleanLeftToken(leftRaw);
  const right = cleanRightToken(rightRaw);
  if (!leftFull || !right) return null;
  if (!/[a-zà-ÿœæ]$/i.test(leftFull)) return null;

  const elided = /['’]/.test(leftFull);
  const left = leftFull.replace(/^.*['’]/, "");

  // 1. Inverted verb-pronoun (`ont-ils une`, `avez-vous un`) -> forbidden after inverted subject pronoun
  if (leftFull.includes("-")) {
    const tail = leftFull.split("-").pop() ?? "";
    if ((tail === "ils" || tail === "elles" || tail === "vous" || tail === "nous" || tail === "on") && startsAcousticVowelOrGlide(right)) {
      const c: LiaisonConsonant = tail === "on" ? "n" : "z";
      return { left: leftFull, right, kind: "forbidden", consonant: c, reason: "inverted_pronoun" };
    }
    return null;
  }

  // 2. Conjunction `et` -> liaison ALWAYS forbidden (`et | il`, `et | en`, `et | un`, `et | à`)
  if (!elided && left === "et" && startsAcousticVowelOrGlide(right)) {
    return { left, right, kind: "forbidden", consonant: "t", reason: "after_et" };
  }

  // 3. Before *h aspiré* or liaison-blocking numerals/glides (`les | héros`, `en | hausse`, `les | huit`, `les | onze`)
  if (isHAspire(right) || NO_LIAISON_WORDS.has(right)) {
    const triggerC =
      (!elided && DETERMINER_CONSONANT[left]) ||
      PRONOUN_CONSONANT[left] ||
      (!elided && PREP_ADV_CONSONANT[left]) ||
      (!elided && PRENOMINAL_ADJ_CONSONANT[left]) ||
      latentFinalConsonant(left);
    if (triggerC) {
      return {
        left,
        right,
        kind: "forbidden",
        consonant: triggerC,
        reason: isHAspire(right) ? "before_h_aspire" : "no_liaison_word",
      };
    }
    return null;
  }

  // 4. Obligatory liaisons before vowel / mute-h
  if (startsVowelSound(right)) {
    if (!elided && left === "neuf" && /^(?:ans?|heures?)$/.test(right)) {
      return { left, right, kind: "obligatory", consonant: "v" };
    }
    if (!elided && DETERMINER_CONSONANT[left]) {
      return { left, right, kind: "obligatory", consonant: DETERMINER_CONSONANT[left] };
    }
    if (PRONOUN_CONSONANT[left] && !NOT_AFTER_PRONOUN.has(right)) {
      return { left, right, kind: "obligatory", consonant: PRONOUN_CONSONANT[left] };
    }
    if (!elided && PREP_ADV_CONSONANT[left]) {
      return { left, right, kind: "obligatory", consonant: PREP_ADV_CONSONANT[left] };
    }
    if (!elided && left === "quand" && /^(?:il|ils|elle|elles|on|est)$/.test(right)) {
      return { left, right, kind: "obligatory", consonant: "t" };
    }
    if (!elided && PRENOMINAL_ADJ_CONSONANT[left] && !NOT_AFTER_PRONOUN.has(right)) {
      return { left, right, kind: "obligatory", consonant: PRENOMINAL_ADJ_CONSONANT[left] };
    }
  }

  // 5. Singular noun ending in a silent consonant before a vowel (`un étudiant | intelligent`, `le gouvernement | a`)
  if (!elided && startsAcousticVowelOrGlide(right)) {
    const prevClean = prevRaw ? cleanLeftToken(prevRaw) : undefined;
    const singC = isSingularNounWithSilentFinal(left, prevClean);
    if (singC) {
      return { left, right, kind: "forbidden", consonant: singC, reason: "singular_noun" };
    }
  }

  return null;
}

/** Scan a French sentence and return all obligatory and forbidden liaison sites across single-space boundaries. */
export function analyzeLiaisons(text: string): LiaisonSite[] {
  const out: LiaisonSite[] = [];
  const re = /\S+/g;
  const tokens: { s: string; start: number; end: number }[] = [];
  for (let m; (m = re.exec(text)); ) tokens.push({ s: m[0], start: m.index, end: m.index + m[0].length });
  for (let i = 0; i + 1 < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (b.start !== a.end + 1 || text[a.end] !== " ") continue;
    if (!/[a-zà-ÿœæ]$/i.test(a.s)) continue;
    const prev = i > 0 && tokens[i - 1].end + 1 === a.start && text[tokens[i - 1].end] === " " ? tokens[i - 1].s : undefined;
    const site = classifyWordBoundaryLiaison(a.s, b.s, prev);
    if (site) out.push({ index: a.end, wordIndex: i, ...site });
  }
  return out;
}

/** Indices of the spaces in `text` that carry an obligatory liaison. */
export function liaisonPoints(text: string): number[] {
  return analyzeLiaisons(text)
    .filter((s) => s.kind === "obligatory")
    .map((s) => s.index);
}
