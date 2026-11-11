#!/usr/bin/env python3
"""Attach a corpus frequency to every lexicon entry, for ordering the learning path.

Source: Lexique 3.83 (New, Pallier et al., www.lexique.org), CC BY-SA 4.0.
  references/lexique/Lexique383.tsv.gz  (gzip of the file copied unchanged from the pylexique
  1.5.1 wheel; uncompressed sha256 fe2cb931f774d4c44abb92fa785a8425b74f668373012ad22e3980fb1bfea0de).
  That copy is Latin-1 encoded; Lexique spells œ/æ as "oe"/"ae" (coeur, oeil), and a few
  lemmas are upper case (FAUX), so lemmas are lower-cased on load.

Measure: lemma frequency per million words, mean of the film-subtitle corpus (freqlemfilms2)
and the book corpus (freqlemlivres). Subtitles track spoken everyday French, books track
written French; the mean is the usual compromise for learners.

Output: data/frequency.json  {meta, entries: {id: {"f": per-million, "m": method}}}
        data/gaps/frequency-missing.csv     visible entries with no frequency (many are OCR noise)
        data/gaps/spelling-suggestions.csv  headwords matched only after ignoring accents
                                            (likely OCR losses: bibliotheque -> bibliothèque).
                                            Suggestions only; lexicon.json is not changed.

Methods, from most to least reliable:
  lemma         lemma + part of speech found in Lexique
  lemma-accent  same, after ignoring accents or reading 'i as ï (the headword probably lost
                an accent in OCR); falls back to any part of speech for words of 4+ letters
  lemma-anypos  lemma found under another part of speech (max over its POS). Not used when the
                entry is a noun/verb/adjective and Lexique only knows the word as a grammatical
                word: "mais n.m. 玉米" is maïs, not the conjunction mais.
  form          not a lemma in Lexique, matched as a written form (form frequency), 3+ letters
  multiword     expression: frequency of its rarest content word x 0.3 (an estimate; expressions
                are rarer than their words). Any unknown content word -> no frequency.
Entries with no frequency are placed after all others in the learning path.

Usage: python3 scripts/build-frequency.py [path/to/Lexique383.tsv or .tsv.gz]
"""
import csv
import gzip
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEXIQUE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "references/lexique/Lexique383.tsv.gz"
MULTIWORD_FACTOR = 0.3

# Lexique cgram tags for each lexicon part of speech.
POS_MAP = {
    "n.m.": {"NOM"}, "n.f.": {"NOM"}, "n.m./f.": {"NOM"}, "n.": {"NOM"},
    "v.": {"VER", "AUX"},
    "adj.": {"ADJ", "ADJ:num", "ADJ:pos", "ADJ:ind", "ADJ:dem", "ADJ:int"},
    "adv.": {"ADV"}, "loc. adv.": {"ADV"},
    "prép.": {"PRE"}, "conj.": {"CON"}, "interj.": {"ONO"},
    "pron.": {"PRO:per", "PRO:dem", "PRO:ind", "PRO:int", "PRO:pos", "PRO:rel"},
}
CONTENT_POS = {"n.m.", "n.f.", "n.m./f.", "n.", "v.", "adj."}
CONTENT_TAGS = {"NOM", "VER", "AUX", "ADJ"}
# Grammatical words skipped when estimating an expression from its content words.
STOP = set("""
a à au aux de d du des en le la les l un une se s y ne n pas sur pour par avec dans sans
et ou que qu qui son sa ses mon ma mes ton ta tes leur leurs ce cet cette ces quelque
quelqu chez sous vers entre contre être avoir faire
""".split())


def num(s: str) -> float:
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return 0.0


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def fold(s: str) -> str:
    """Remove accents: bibliothèque -> bibliotheque."""
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


class Lexique:
    def __init__(self, path: Path):
        self.lemma_pos: dict[tuple[str, str], float] = {}
        self.lemma_tags: dict[str, set[str]] = {}
        self.form: dict[str, float] = {}
        # accent-folded (lemma, tag) -> (freq, original lemma), keeping the most frequent
        self.folded: dict[tuple[str, str], tuple[float, str]] = {}
        self.folded_any: dict[str, tuple[float, str]] = {}
        opener = gzip.open if path.suffix == ".gz" else open
        with opener(path, "rt", encoding="latin-1", newline="") as fh:
            rd = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
            head = next(rd)
            col = {name.split("_", 1)[1]: i for i, name in enumerate(head)}
            for row in rd:
                ortho = nfc(row[col["ortho"]]).lower()
                lemme = nfc(row[col["lemme"]]).lower()
                cgram = row[col["cgram"]]
                fl = (num(row[col["freqlemfilms2"]]) + num(row[col["freqlemlivres"]])) / 2
                ff = (num(row[col["freqfilms2"]]) + num(row[col["freqlivres"]])) / 2
                k = (lemme, cgram)
                self.lemma_pos[k] = max(self.lemma_pos.get(k, 0.0), fl)
                self.lemma_tags.setdefault(lemme, set()).add(cgram)
                self.form[ortho] = self.form.get(ortho, 0.0) + ff
                fk = (fold(lemme), cgram)
                if fl > self.folded.get(fk, (0.0, ""))[0]:
                    self.folded[fk] = (fl, lemme)
                if fl > self.folded_any.get(fk[0], (0.0, ""))[0]:
                    self.folded_any[fk[0]] = (fl, lemme)

    def lemma_any(self, w: str) -> float:
        return max((self.lemma_pos[(w, t)] for t in self.lemma_tags.get(w, ())), default=0.0)

    def lookup(self, w: str, tags: set[str], content: bool):
        """Return (freq, method, suggested spelling or None)."""
        hits = [self.lemma_pos[(w, t)] for t in tags if (w, t) in self.lemma_pos]
        if hits and max(hits) > 0:
            return max(hits), "lemma", None
        folded = [self.folded[(fold(w), t)] for t in tags if (fold(w), t) in self.folded]
        if folded:
            f, spelled = max(folded)
            if f > 0:
                return f, "lemma-accent", (spelled if spelled != w else None)
        if len(w) >= 2 and self.lemma_any(w) > 0:
            if not (content and not (self.lemma_tags[w] & CONTENT_TAGS)):
                return self.lemma_any(w), "lemma-anypos", None
        if len(w) >= 3 and self.form.get(w, 0) > 0:
            return self.form[w], "form", None
        if len(w) >= 4 and fold(w) in self.folded_any:
            f, spelled = self.folded_any[fold(w)]
            if f > 0 and not (content and not (self.lemma_tags[spelled] & CONTENT_TAGS)):
                return f, "lemma-accent", (spelled if spelled != w else None)
        return None, None, None


def clean_lemma(lemma: str, pos: str) -> str:
    s = nfc(lemma).strip().lower().replace("’", "'").replace("œ", "oe").replace("æ", "ae")
    s = re.sub(r"^(le|la|les|un|une)\s+", "", s)
    s = re.sub(r"^l'", "", s)
    if pos == "v.":
        s = re.sub(r"^(se\s+|s')", "", s)
    return s


def frequency(entry, lx: Lexique):
    pos = entry["pos"]
    w = clean_lemma(entry["lemma"], pos)
    if not w or re.search(r"[/;()\[\]*•]", w):
        return None, None, None  # alternatives, notes or OCR debris in the headword
    # OCR often renders ï as 'i (ha'ir -> haïr, la'ic -> laïc)
    for cand in dict.fromkeys([w, w.replace("'i", "ï")]):
        f, m, sug = lx.lookup(cand, POS_MAP.get(pos, set()), pos in CONTENT_POS)
        if f is not None:
            if cand != w:
                m, sug = "lemma-accent", (sug or cand)
            return f, m, sug
    tokens = [t for t in re.split(r"[\s']+", w) if t]
    if len(tokens) < 2:
        return None, None, None
    content = [t for t in tokens if t not in STOP]
    if not content:
        return None, None, None
    freqs = []
    for t in content:
        ft, _, _ = lx.lookup(t, set(), False)
        if ft is None:
            return None, None, None
        freqs.append(ft)
    return min(freqs) * MULTIWORD_FACTOR, "multiword", None


def main():
    lex = json.loads((ROOT / "data/lexicon.json").read_text(encoding="utf-8"))
    lx = Lexique(LEXIQUE)
    out, missing, suggestions = {}, [], []
    counts: dict[str, int] = {}
    for e in lex["entries"]:
        f, m, sug = frequency(e, lx)
        if f is None:
            if not e.get("aliasOf"):
                missing.append(e)
            counts["none"] = counts.get("none", 0) + 1
            continue
        out[e["id"]] = {"f": round(f, 3), "m": m}
        counts[m] = counts.get(m, 0) + 1
        if sug and not e.get("aliasOf"):
            suggestions.append((e, sug))
    meta = {
        "source": "Lexique 3.83 (New, Pallier et al., www.lexique.org)",
        "license": "CC BY-SA 4.0 — https://creativecommons.org/licenses/by-sa/4.0/",
        "measure": "lemma frequency per million words, mean of freqlemfilms2 and freqlemlivres",
        "methods": dict(sorted(counts.items())),
        "generated": date.today().isoformat(),
        "script": "scripts/build-frequency.py",
    }
    (ROOT / "data/frequency.json").write_text(
        json.dumps({"meta": meta, "entries": out}, ensure_ascii=False, indent=0, sort_keys=True) + "\n", encoding="utf-8")
    gaps = ROOT / "data/gaps"
    gaps.mkdir(parents=True, exist_ok=True)
    zh = lambda e: next((s["zh"] for s in e["senses"] if s["zh"]), "")
    with (gaps / "frequency-missing.csv").open("w", encoding="utf-8", newline="") as fh:
        wr = csv.writer(fh)
        wr.writerow(["id", "lemma", "pos", "zh"])
        for e in missing:
            wr.writerow([e["id"], e["lemma"], e["pos"], zh(e)])
    with (gaps / "spelling-suggestions.csv").open("w", encoding="utf-8", newline="") as fh:
        wr = csv.writer(fh)
        wr.writerow(["id", "lemma", "pos", "suggested", "zh"])
        for e, sug in suggestions:
            wr.writerow([e["id"], e["lemma"], e["pos"], sug, zh(e)])
    visible = sum(1 for e in lex["entries"] if not e.get("aliasOf"))
    print(f"frequency: {len(out)} entries with a value; visible without: {len(missing)}/{visible}; "
          f"accent suggestions: {len(suggestions)}; methods {meta['methods']}")


if __name__ == "__main__":
    main()
