import { foldAccents } from "./accent";
import type { Entry } from "../atlas/types";

export const PURE_FR_KEY = "word-atlas:pure-fr";

/** Pure-French cue mode (hide full Chinese sentence translations before answering). Defaults to ON for CE-2 training. */
export function readPureFr(): boolean {
  try {
    return localStorage.getItem(PURE_FR_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writePureFr(v: boolean): void {
  try {
    localStorage.setItem(PURE_FR_KEY, v ? "1" : "0");
  } catch {
    /* ignore storage unavailable */
  }
}

/** Concise French B2 definitions (sans mot-clé) for core high-frequency vocabulary. */
export const CORE_FR_DEFS: Record<string, string> = {
  neanmoins: "Adverbe marquant une opposition ou une concession malgré ce qui précède (syn. toutefois, pourtant).",
  toutefois: "Introduit une restriction ou une nuance par rapport à l'idée principale.",
  cependant: "Marque un contraste entre deux faits (registre courant à soutenu).",
  malgre: "Préposition suivie d'un nom exprimant une concession (éviter « malgré que »).",
  bien: "Employé dans « bien que + subjonctif » pour exprimer la concession.",
  davantage: "Adverbe de quantité signifiant « plus, encore plus » (jamais suivi de « que »).",
  desormais: "À partir de maintenant et pour l'avenir.",
  auparavant: "Avant le moment dont on parle (dans le passé).",
  parvenir: "Réussir à obtenir ou à accomplir quelque chose après un effort.",
  susceptible: "Qui peut provoquer quelque chose ou qui est capable de le faire (+ de + infinitif).",
  enjeu: "Ce que l'on peut gagner ou perdre dans une situation, un débat ou un projet.",
  essor: "Développement rapide et important d'un domaine, d'une activité.",
  lacune: "Manque, défaut dans un ensemble, une formation ou une argumentation.",
  ecart: "Différence notable entre deux valeurs, deux situations ou deux groupes.",
  contrainte: "Règle ou obligation qui limite la liberté d'action.",
  marge: "Espace d'action disponible (marge de manœuvre).",
  entraver: "Freiner, gêner l'évolution ou l'action de quelque chose.",
  pallier: "Compenser, atténuer un manque ou une difficulté (verbe transitif direct, sans « à »).",
  engendrer: "Produire comme conséquence, faire naître un phénomène.",
  susciter: "Provoquer une réaction, un débat ou un sentiment chez autrui.",
  attenuer: "Rendre moins fort, moins grave ou moins pénible.",
  aggraver: "Rendre une situation encore pire qu'auparavant.",
  renforcer: "Rendre plus solide, plus intense ou plus efficace.",
  favoriser: "Encourager, aider le développement de quelque chose.",
  nuire: "Causer du tort, faire du mal à quelqu'un ou à quelque chose (+ à).",
  menacer: "Mettre en danger ou annoncer un risque sérieux.",
  preserver: "Protéger quelque chose contre une dégradation ou un danger.",
  garantir: "Assurer de façon certaine le maintien d'un droit ou d'une qualité.",
  concilier: "Mettre en accord deux exigences qui paraissent opposées.",
  sensibiliser: "Rendre quelqu'un attentif et conscient face à un problème.",
  encadrer: "Fixer des règles strictes pour limiter les abus d'une pratique.",
  reguler: "Maintenir l'équilibre d'un système par des règles adaptées.",
  subventionner: "Accorder une aide financière publique à une activité ou un projet.",
  repartir: "Distribuer entre plusieurs personnes ou groupes selon un critère.",
  precarite: "Situation fragile et instable, notamment sur le plan de l'emploi ou du logement.",
  inegalite: "Absence d'égalité entre des personnes ou des régions.",
  sobriete: "Consommation modérée et réfléchie visant à économiser les ressources.",
  perenne: "Qui dure longtemps, stable dans le temps.",
  incontournable: "Essentiel, qu'on ne peut ni ignorer ni éviter.",
  indeniable: "Évident, qu'on ne peut pas contester sérieusement.",
  pertinent: "Bien adapté au sujet, logique et convaincant.",
  nuance: "Opinion équilibrée qui évite les positions extrêmes.",
  constat: "Observation objective d'une situation réelle.",
  tendance: "Évolution générale observée sur une période.",
  delai: "Temps accordé pour accomplir une action.",
  biais: "Déformation ou influence indirecte faussant un jugement ou un algorithme.",
  fiable: "Digne de confiance, exact et régulier.",
  efficace: "Qui produit réellement l'effet attendu.",
  durable: "Conçu pour durer sans épuiser les ressources futures.",
  numerique: "Relatif aux technologies de l'information, aux ordinateurs et à Internet.",
  citoyen: "Habitant jouissant de droits civiques et participant à la vie publique.",
  democratie: "Régime politique dans lequel le pouvoir appartient aux citoyens.",
  patrimoine: "Ensemble des biens culturels, historiques ou naturels hérités du passé.",
  croissance: "Augmentation mesurée de l'activité économique ou d'un phénomène.",
  inflation: "Hausse générale et durable des prix.",
  pouvoir: "Capacité d'agir ou autorité exercée ; « pouvoir d'achat » = capacité de consommer.",
};

const normKey = (w: string) => foldAccents(w).toLowerCase().replace(/^l['’]|^(?:un|une|le|la|les)\s+/i, "").trim();

/**
 * Build a pure-French clue for an atlas entry when hiding Chinese translations:
 * prefers explicit B2 French definition, then French collocations/synonyms (Chinese stripped), else POS only.
 */
export function frenchClueFor(entry: Pick<Entry, "w" | "senses" | "col" | "syn">): string {
  const def = CORE_FR_DEFS[normKey(entry.w)];
  const pos = entry.senses?.[0]?.pos;
  if (def) return pos ? `${pos} · ${def}` : def;
  const cols = (entry.col ?? [])
    .map((c) => c.split("｜")[0]?.trim())
    .filter((c) => c && !foldAccents(c.toLowerCase()).includes(foldAccents(entry.w.toLowerCase())))
    .slice(0, 2);
  if (cols.length) return `${pos ? `${pos} · ` : ""}Expressions associées : ${cols.join(" ; ")}`;
  const syns = (entry.syn ?? []).map((s) => s.replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean).slice(0, 3);
  if (syns.length) return `${pos ? `${pos} · ` : ""}Proche de : ${syns.join(", ")}`;
  return pos ? `Catégorie : ${pos}` : "Déduisez le mot d'après le contexte de la phrase.";
}
