#!/usr/bin/env python3
"""Attach an IPA transcription to every lexicon entry (shown next to the word and on cards).

Source: Lexique 3.83 (New, Pallier et al., www.lexique.org), CC BY-SA 4.0, column "phon"
  (references/lexique/Lexique383.tsv.gz, see build-frequency.py). Lexique's one-character phoneme
  code is converted to IPA by a fixed table; no pronunciation is guessed.

Methods:
  word     one word found in Lexique as an exact written form; when several rows share the
           spelling, the row whose part of speech matches the entry wins, then the most frequent
           (fils -> /fis/, not /fil/).
  compound expression or hyphenated word: each word looked up as above and joined with spaces.
           Elision (l', d', j', qu' ...) is handled; liaison between words is NOT modelled.
  folded   accents missing in the headword (OCR loss: Etat) and every candidate spelling gives the
           same sound. Skipped when candidates disagree (tache / tâche).
Entries with no certain transcription get none (listed in data/gaps/ipa-missing.csv).

Output: data/ipa.json  {meta, entries: {id: {"p": "ɛtʁ", "m": method}}}
Usage:  python3 scripts/build-ipa.py [path/to/Lexique383.tsv or .tsv.gz]
"""
import csv
import gzip
import json
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEXIQUE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "references/lexique/Lexique383.tsv.gz"

PHON = {
    "a": "a", "A": "ɑ", "e": "e", "E": "ɛ", "i": "i", "o": "o", "O": "ɔ", "u": "u", "y": "y",
    "2": "ø", "9": "œ", "°": "ə", "@": "ɑ̃", "5": "ɛ̃", "1": "œ̃", "§": "ɔ̃",
    "8": "ɥ", "w": "w", "j": "j",
    "p": "p", "b": "b", "t": "t", "d": "d", "k": "k", "g": "g", "f": "f", "s": "s", "S": "ʃ",
    "v": "v", "z": "z", "Z": "ʒ", "m": "m", "n": "n", "N": "ɲ", "G": "ŋ", "l": "l", "R": "ʁ", "r": "ʁ", "x": "x",
}
POS_MAP = {
    "n.m.": ("NOM",), "n.f.": ("NOM",), "n.m./f.": ("NOM",), "n.": ("NOM",),
    "v.": ("VER", "AUX"), "adj.": ("ADJ",), "adv.": ("ADV",), "loc. adv.": ("ADV",),
    "prép.": ("PRE",), "conj.": ("CON",), "interj.": ("ONO",), "pron.": ("PRO",),
}
# Elided forms are not in Lexique as one word: j' = /ʒ/, qu' = /k/ ...
ELIDED = {"l": "l", "d": "d", "j": "ʒ", "m": "m", "t": "t", "s": "s", "n": "n", "c": "s", "qu": "k", "jusqu": "ʒysk", "lorsqu": "lɔʁsk", "puisqu": "pɥisk", "quoiqu": "kwak"}


def nfc(s):
    return unicodedata.normalize("NFC", s)


def fold(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def ipa(code):
    out = []
    for ch in code:
        if ch in PHON:
            out.append(PHON[ch])
        elif ch in "0-":
            continue
        else:
            return None
    return "".join(out)


class Lex:
    def __init__(self, path):
        self.rows = defaultdict(list)  # ortho -> [(phon, cgram, freq)]
        self.folded = defaultdict(set)  # folded ortho -> {phon}
        opener = gzip.open if path.suffix == ".gz" else open
        with opener(path, "rt", encoding="latin-1", newline="") as fh:
            rd = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
            head = next(rd)
            col = {n.split("_", 1)[1]: i for i, n in enumerate(head)}
            for r in rd:
                o = nfc(r[col["ortho"]]).lower()
                p = ipa(r[col["phon"]])
                if not p:
                    continue
                f = 0.0
                for k in ("freqfilms2", "freqlivres"):
                    try:
                        f += float(r[col[k]].replace(",", "."))
                    except ValueError:
                        pass
                self.rows[o].append((p, r[col["cgram"]], f))
                self.folded[fold(o)].add(p)

    def word(self, w, tags=()):
        w = w.replace("œ", "oe").replace("æ", "ae")
        rows = self.rows.get(w)
        if not rows:
            return None
        pick = [r for r in rows if any(r[1].startswith(t) for t in tags)] or rows
        return max(pick, key=lambda r: r[2])[0]

    def folded_word(self, w):
        if len(w) < 4:
            return None
        ps = self.folded.get(fold(w.replace("œ", "oe")))
        return next(iter(ps)) if ps and len(ps) == 1 else None


def transcribe(lex, lemma, pos):
    text = re.sub(r"\([^)]*\)", "", nfc(lemma)).lower().replace("’", "'").strip()
    if not text or re.search(r"[^a-zàâäçéèêëîïôöùûüÿœæ' \-]", text):
        return None
    tags = POS_MAP.get(pos, ())
    whole = lex.word(text, tags)
    if whole and " " not in text and "'" not in text:
        return whole, "word"
    parts = []
    for tok in re.findall(r"[^ ']+'?|'", text.replace("-", " ")):
        tok = tok.strip()
        if not tok or tok == "'":
            continue
        if tok.endswith("'"):
            p = ELIDED.get(tok[:-1])
            if p is None:
                return None
            parts.append(("elide", p))
            continue
        p = lex.word(tok) or lex.folded_word(tok)
        if p is None:
            return None
        parts.append(("word", p))
    if not parts:
        return None
    out = ""
    for i, (kind, p) in enumerate(parts):
        out += p
        if kind == "word" and i < len(parts) - 1:
            out += " "
    if len(parts) == 1:
        return out, "word"
    return out, "compound"


def main():
    lex = Lex(LEXIQUE)
    lexicon = json.load(open(ROOT / "data/lexicon.json", encoding="utf-8"))["entries"]
    entries, missing, counts = {}, [], defaultdict(int)
    for e in lexicon:
        if e.get("aliasOf"):
            continue
        r = transcribe(lex, e["lemma"], e["pos"])
        method = r[1] if r else None
        if r is None:
            single = " " not in e["lemma"] and "'" not in e["lemma"] and "-" not in e["lemma"]
            f = lex.folded_word(e["lemma"].lower()) if single else None
            if f:
                r, method = (f, "folded")
        if r:
            entries[e["id"]] = {"p": r[0], "m": method}
            counts[method] += 1
        else:
            missing.append((e["id"], e["lemma"], e["pos"]))
    meta = {
        "source": "Lexique 3.83 (www.lexique.org), CC BY-SA 4.0, column phon; Lexique code converted to IPA",
        "generated": date.today().isoformat(),
        "counts": dict(counts),
        "missing": len(missing),
        "note": "compound = words joined with spaces; liaison between words is not modelled",
    }
    json.dump({"meta": meta, "entries": entries}, open(ROOT / "data/ipa.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    gaps = ROOT / "data/gaps"
    gaps.mkdir(exist_ok=True)
    with open(gaps / "ipa-missing.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "lemma", "pos"])
        w.writerows(missing)
    print(meta)


main()
