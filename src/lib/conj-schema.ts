export type SimpleTense = "pres" | "imp" | "fut" | "cond" | "subj";
export type CompoundTense = "pc" | "pqp" | "fa" | "condp" | "subjp";
export type ConjTense = SimpleTense | CompoundTense | "ppres" | "imper";

export const TENSES: ConjTense[] = ["pres", "pc", "imp", "fut", "cond", "subj", "pqp", "fa", "condp", "subjp", "ppres", "imper"];
