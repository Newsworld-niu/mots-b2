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
WILDCARD = {"qqn", "qqch", "qch", "qc", "qn", "qe", "qq", "etc"}  # qn/qc/qe: "quelqu'un / quelque chose" slots in lexicon lemmas
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


CONTRACTED = {"à": {"au", "aux"}, "de": {"du", "des", "d"}}


def tokens_match(lex, a, b):
    """Same spelling, same spelling without accents, same lemma (accents ignored), or a contracted preposition
    (à -> au / aux, de -> du / des / d') standing for the one in the expression."""
    if a == b or fold(a) == fold(b):
        return True
    if a in CONTRACTED.get(b, ()) or b in CONTRACTED.get(a, ()):
        return True
    return bool({fold(x) for x in lex.lemmas(a)} & {fold(x) for x in lex.lemmas(b)})


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


def gap_match(lex, toks, sent, max_gap=2):
    """Expression whose words are not all adjacent (être... de profession, est architecte de profession,
    ont ... accès à). Words are matched in order; at most max_gap sentence words may sit between two matches.
    Returns (start, end, matched) for the best window, or None. Needs at least two matches, one of them a content word."""
    best = None
    n = len(sent)
    for s in range(n):
        if not tokens_match(lex, sent[s][0], toks[0]):
            continue
        k, last, gap, first_idx, hits = 1, s, 0, s, [s]
        for j in range(s + 1, min(n, s + 4 * len(toks) + 4)):
            if k >= len(toks):
                break
            if tokens_match(lex, sent[j][0], toks[k]):
                hits.append(j); last = j; k += 1; gap = 0
            else:
                gap += 1
                if gap > max_gap:
                    break
        matched = [toks[i] for i in range(len(hits))]
        content = any(len(fold(sent[h][0])) >= 4 for h in hits) or any(len(t) >= 4 for t in toks[:len(hits)])
        if len(hits) < 2 or not content:
            continue
        cand = (len(hits), -(sent[last][2] - sent[first_idx][1]))
        if best is None or cand > best[0]:
            best = (cand, sent[first_idx][1], sent[last][2], len(hits))
    return None if best is None else (best[1], best[2], best[3])


def contiguous(lex, core, sent):
    n = len(core)
    for i in range(len(sent) - n + 1):
        if all(tokens_match(lex, sent[i + k][0], core[k]) for k in range(n)):
            return i, i + n - 1
    return None


def find_alt(lex, words_, tags, sent, pos):
    """Locate one spelling of the headword in a sentence. Returns (start, end, score) or None."""
    if len(words_) == 1:
        w = words_[0]
        wl = lex.lemmas(w)
        exact = typed = loose = None
        for t, s, e in sent:
            if t == w:
                exact = exact or (s, e)
            elif lex.lemma_pos(t, w, tags):
                typed = typed or (s, e)
            elif wl & lex.lemmas(t) or fold(t) == fold(w):
                loose = loose or (s, e)
        r = exact or typed or loose or stem_match(w, pos, sent)
        return None if r is None else (r[0], r[1], 1)
    reflexive = words_[0] in ("se", "s")
    core = words_[1:] if reflexive and len(words_) > 1 else words_
    hit = contiguous(lex, core, sent)
    if hit:
        i, j = hit
        start = sent[i][1]
        if reflexive and i > 0 and sent[i - 1][0] in REFLEXIVE:
            start = sent[i - 1][1]
        return (start, sent[j][2], len(core))
    g = gap_match(lex, core, sent)
    if g:
        return (g[0], g[1], g[2])
    return None


def find(lex, lemma, pos, sentence):
    """Span of the headword in the sentence, or None. A multi-word headword is highlighted only when at least two of
    its words are found; a single word is never returned for an expression of two or more words. Alternatives
    separated by '/' (démissionner/donner sa démission) are tried one by one and the best one is used."""
    sent = words(sentence)
    if not sent:
        return None
    base = re.sub(r"\([^)]*\)", " ", norm(lemma))
    tags = POS_MAP.get(pos, ())
    best = None
    parts = base.split("/")
    alts = parts
    first = words(parts[0])
    if len(first) >= 2 and len(parts) > 1 and all(len(words(p)) == 1 for p in parts[1:]):
        head = " ".join(w for w, _, _ in first[:-1])  # "temps plein/partiel" -> "temps plein", "temps partiel"
        alts = [parts[0]] + [head + " " + p for p in parts[1:]]
    for alt in alts:
        toks = [w for w, _, _ in words(alt) if w not in WILDCARD]
        if not toks:
            continue
        r = find_alt(lex, toks, tags, sent, pos)
        if r and (best is None or r[2] > best[2]):
            best = r
    return None if best is None else (best[0], best[1])


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
