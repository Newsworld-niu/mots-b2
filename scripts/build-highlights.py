#!/usr/bin/env python3
"""Locate each headword inside its example sentences (for highlighting and cloze blanks).

French inflects heavily (veux / voulez / voulu -> vouloir; yeux -> œil; s'est plainte -> se plaindre),
so the span is found at build time with Lexique 3.83, which maps every written form to its lemma
(references/lexique/Lexique383.tsv.gz, CC BY-SA 4.0; see build-frequency.py).

Matching:
  single word  the sentence word spelled like the headword; else one whose Lexique lemma is the headword
               (same part of speech first); else one sharing a lemma with it (détruit / détruits).
  expression   consecutive sentence words that match the expression's words one by one, each by
               spelling or by shared lemma (avoir besoin d'argent -> "ai besoin d'argent"). Reflexive
               pronouns are matched loosely (se souvenir -> "me souviens") and included.
               When the whole expression is not found, its first content word is marked alone.
  none         no span; the app then shows the sentence without a highlight and asks the cloze
               question with the Chinese gloss instead.

Output: data/highlights.json  {meta, entries: {id: [[start, end] | null, ...]}}  one item per example,
        offsets in UTF-16 code units of the example text (what JavaScript's slice() uses).
Usage:  python3 scripts/build-highlights.py [path/to/Lexique383.tsv or .tsv.gz]
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

POS_MAP = {
    "n.m.": ("NOM",), "n.f.": ("NOM",), "n.m./f.": ("NOM",), "n.": ("NOM",),
    "v.": ("VER", "AUX"), "adj.": ("ADJ",), "adv.": ("ADV",), "loc. adv.": ("ADV",),
    "prép.": ("PRE",), "conj.": ("CON",), "interj.": ("ONO",), "pron.": ("PRO",),
}
WILDCARD = {"qqn", "qqch", "qch", "etc"}
REFLEXIVE = {"me", "m", "te", "t", "se", "s", "nous", "vous"}
WORD = re.compile(r"[^\W\d_]+", re.UNICODE)


def nfc(s):
    return unicodedata.normalize("NFC", s)


def norm(s):
    """Lower case, œ/æ spelled out as Lexique does, curly apostrophes straight."""
    return nfc(s).lower().replace("œ", "oe").replace("æ", "ae").replace("’", "'")


def fold(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


class Lex:
    def __init__(self, path):
        self.forms = defaultdict(set)  # written form -> {(lemma, cgram)}
        opener = gzip.open if path.suffix == ".gz" else open
        with opener(path, "rt", encoding="latin-1", newline="") as fh:
            rd = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
            head = next(rd)
            col = {n.split("_", 1)[1]: i for i, n in enumerate(head)}
            for r in rd:
                self.forms[nfc(r[col["ortho"]]).lower()].add((nfc(r[col["lemme"]]).lower(), r[col["cgram"]]))

    def lemmas(self, tok):
        return {lm for lm, _ in self.forms.get(tok, ())} | {tok}

    def lemma_pos(self, tok, lemma, tags):
        return any(lm == lemma and any(cg.startswith(t) for t in tags) for lm, cg in self.forms.get(tok, ()))


def words(text):
    return [(norm(m.group()), m.start(), m.end()) for m in WORD.finditer(text)]


def utf16(text, i):
    """Code-point index -> UTF-16 offset."""
    return i + sum(1 for ch in text[:i] if ord(ch) > 0xFFFF)


def tokens_match(lex, a, b):
    return a == b or fold(a) == fold(b) or bool(lex.lemmas(a) & lex.lemmas(b))


def stem_match(w, pos, sent):
    """Last resort for forms Lexique does not list (collectent, validez, environnementales, cyberdépendants):
    a sentence word that starts with the headword (minus a verb's -er/-ir/-re) and adds at most a short ending.
    Stems shorter than five letters are never matched this way (cour ≠ cours, foi ≠ fois)."""
    f = fold(w)
    stem = f[:-2] if pos == "v." and f[-2:] in ("er", "ir", "re") else f
    if len(stem) < 5:
        return None
    for t, s, e in sent:
        ft = fold(t)
        if ft.startswith(stem) and len(ft) - len(stem) <= 4:
            return (s, e)
    return None


def find(lex, lemma, pos, sentence):
    sent = words(sentence)
    if not sent:
        return None
    base = re.sub(r"\([^)]*\)", " ", norm(lemma))
    pw = [w for w, _, _ in words(base) if w not in WILDCARD]
    if not pw:
        return None
    tags = POS_MAP.get(pos, ())

    if len(pw) == 1:
        w = pw[0]
        wl = lex.lemmas(w)
        exact = typed = loose = None
        for t, s, e in sent:
            if t == w:
                exact = exact or (s, e)
            elif lex.lemma_pos(t, w, tags):
                typed = typed or (s, e)
            elif wl & lex.lemmas(t) or fold(t) == fold(w):
                loose = loose or (s, e)
        # identical spelling first (mourir, not the participle mort), then the same part of speech, then any shared lemma
        return exact or typed or loose or stem_match(w, pos, sent)

    reflexive = pw[0] in ("se", "s")
    core = pw[1:] if reflexive and len(pw) > 1 else pw
    n = len(core)
    for i in range(len(sent) - n + 1):
        if all(tokens_match(lex, sent[i + k][0], core[k]) for k in range(n)):
            start = sent[i][1]
            if reflexive and i > 0 and sent[i - 1][0] in REFLEXIVE:
                start = sent[i - 1][1]
            return (start, sent[i + n - 1][2])
    # Whole expression absent (word order, inserted words): mark its first content word only.
    for w in core:
        if len(w) < 4:
            continue
        for t, s, e in sent:
            if tokens_match(lex, t, w):
                return (s, e)
    return None


def main():
    lex = Lex(LEXIQUE)
    lexicon = json.load(open(ROOT / "data/lexicon.json", encoding="utf-8"))["entries"]
    out, total, hit = {}, 0, 0
    for e in lexicon:
        if e.get("aliasOf") or not e["examples"]:
            continue
        spans = []
        for ex in e["examples"]:
            total += 1
            r = find(lex, e["lemma"], e["pos"], ex["fr"])
            if r:
                hit += 1
                spans.append([utf16(ex["fr"], r[0]), utf16(ex["fr"], r[1])])
            else:
                spans.append(None)
        if any(spans):
            out[e["id"]] = spans
    meta = {
        "source": "Lexique 3.83 (www.lexique.org), CC BY-SA 4.0: written form -> lemma",
        "generated": date.today().isoformat(),
        "examples": total,
        "located": hit,
    }
    json.dump({"meta": meta, "entries": out}, open(ROOT / "data/highlights.json", "w", encoding="utf-8"), ensure_ascii=False)
    print(meta, f"{hit / total:.1%}")


main()
