#!/usr/bin/env python3
"""Irregular noun plurals, adjective feminine / plural forms and adjective position, for the entry sheet.

Input:  data/lexicon.json
        references/lexique/Lexique383.tsv.gz (Lexique 3.83, CC BY-SA 4.0): inflected forms with frequencies
Output: data/forms.json  {meta, entries: {id: {pl?, fem?, mpl?, place?}}}

Only what a learner cannot guess is kept:
  pl     noun plural when the most frequent plural is not "+s" (travail → travaux, œil → yeux)
  fem    adjective feminine when it is not "+e" (beau → belle, actif → active, public → publique)
  mpl    adjective masculine plural when it is not "+s" (beau → beaux, général → généraux)
  place  short note when an adjective usually goes before the noun, or changes meaning with its place

Forms come from Lexique only; a word Lexique does not know gets nothing (no guessing).
Usage: python3 scripts/build-forms.py
"""
import csv
import gzip
import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEXIQUE = ROOT / "references/lexique/Lexique383.tsv.gz"
OUT = ROOT / "data/forms.json"
NOUN_POS = {"n.m.", "n.f.", "n.m./f."}

# Adjectives that usually come before the noun (the "BANGS" group and a few others).
BEFORE = {
    "beau": "通常放在名词前（un beau jardin）；元音或哑音 h 前的阳性单数用 bel（un bel homme）",
    "nouveau": "通常放在名词前（un nouveau film）；元音或哑音 h 前的阳性单数用 nouvel（un nouvel ami）",
    "vieux": "通常放在名词前（un vieux livre）；元音或哑音 h 前的阳性单数用 vieil（un vieil arbre）",
    "joli": "通常放在名词前（une jolie maison）",
    "bon": "通常放在名词前（un bon repas）",
    "mauvais": "通常放在名词前（une mauvaise idée）",
    "meilleur": "通常放在名词前（le meilleur moment）",
    "petit": "通常放在名词前（un petit village）",
    "gros": "通常放在名词前（un gros chien）",
    "jeune": "通常放在名词前（une jeune femme）",
    "long": "通常放在名词前（un long voyage）",
    "haut": "通常放在名词前（une haute montagne）",
    "premier": "通常放在名词前（le premier jour）",
    "autre": "放在名词前（une autre fois）",
}
# Adjectives whose meaning depends on their place.
VARY = {
    "grand": "放在名词前多指“伟大的”（un grand homme 伟人），放在后面指“高大的”（un homme grand 高个子男人）",
    "ancien": "前：以前的（un ancien élève 老校友）；后：古老的（une maison ancienne 古宅）",
    "cher": "前：亲爱的（mon cher ami）；后：昂贵的（un repas cher）",
    "propre": "前：自己的（ma propre voiture）；后：干净的（une voiture propre）",
    "pauvre": "前：可怜的（le pauvre homme）；后：贫穷的（un homme pauvre）",
    "seul": "前：唯一的（le seul ami）；后：独自的（un homme seul）",
    "dernier": "前：最后的（la dernière semaine des vacances）；后：上一个的（la semaine dernière 上周）",
    "prochain": "前：（顺序上的）下一个（la prochaine fois）；后：（时间上的）下一个（la semaine prochaine 下周）",
    "même": "前：同一个（le même jour）；后：恰恰、本身（le jour même 就在当天）",
    "certain": "前：某些（certaines personnes）；后：确定的（une chose certaine）",
}


def key(s: str) -> str:
    # Lexique is Latin-1, which has no œ / æ: it writes "oeil", "coeur"
    return s.strip().lower().replace("’", "'").replace("œ", "oe").replace("æ", "ae")


def show(form: str, lemma: str) -> str:
    """Put the ligature back in a form taken from Lexique when the headword has one (sœur → sœurs)."""
    return form.replace("oe", "œ") if "œ" in lemma else form


def num(s: str) -> float:
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return 0.0


def load_lexique():
    """{(lemme, cgram): [(ortho, genre, nombre, freq)]} for NOM and ADJ rows."""
    out: dict[tuple[str, str], list[tuple[str, str, str, float]]] = {}
    with gzip.open(LEXIQUE, "rt", encoding="latin-1", newline="") as fh:
        rd = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
        head = next(rd)
        col = {n.split("_", 1)[1]: i for i, n in enumerate(head)}
        for row in rd:
            cg = row[col["cgram"]]
            if cg not in ("NOM", "ADJ"):
                continue
            f = num(row[col["freqfilms2"]]) + num(row[col["freqlivres"]])
            out.setdefault((key(row[col["lemme"]]), cg), []).append((key(row[col["ortho"]]), row[col["genre"]], row[col["nombre"]], f))
    return out


def best(rows, genre=None, nombre=None):
    """Most frequent written form with this gender / number ('' in Lexique means either)."""
    cand = [r for r in rows if (genre is None or r[1] in (genre, "")) and (nombre is None or r[2] in (nombre, ""))]
    cand.sort(key=lambda r: -r[3])
    return cand[0][0] if cand else None


def regular_plural(w: str) -> set[str]:
    return {w} if w[-1:] in "sxz" else {w + "s"}


def main():
    lex = load_lexique()
    data = json.loads((ROOT / "data/lexicon.json").read_text("utf8"))
    entries: dict[str, dict[str, str]] = {}
    for e in data["entries"]:
        if e.get("aliasOf"):
            continue
        w = key(e["lemma"])
        if " " in w:
            continue
        g = {"n.m.": "m", "n.f.": "f"}.get(e["pos"])
        info: dict[str, str] = {}
        if e["pos"] in NOUN_POS and g and not e.get("forms"):
            # same gender only: a masculine noun must not get its feminine's plural (caissier ≠ caissières)
            rows = [r for r in lex.get((w, "NOM"), []) if r[1] in (g, "")]
            sing = [r for r in rows if r[2] in ("s", "") and r[0] == w]
            pl = best([r for r in rows if r[2] == "p"])
            if sing and pl and pl not in regular_plural(w):
                info["pl"] = show(pl, e["lemma"])
        elif e["pos"] == "adj.":
            rows = lex.get((w, "ADJ"), [])
            if any(r[0] == w for r in rows):
                fem = best([r for r in rows if r[1] == "f" and r[2] == "s"])
                if fem and fem != w and fem != w + "e":
                    info["fem"] = show(fem, e["lemma"])
                mpl = best([r for r in rows if r[1] == "m" and r[2] == "p"])
                if mpl and mpl not in regular_plural(w):
                    info["mpl"] = show(mpl, e["lemma"])
            w = e["lemma"].strip().lower()
            if w in BEFORE:
                info["place"] = BEFORE[w]
            elif w in VARY:
                info["place"] = VARY[w]
        if info:
            entries[e["id"]] = info
    meta = {"generated": date.today().isoformat(), "source": "Lexique 3.83 (CC BY-SA 4.0) + scripts/build-forms.py", "count": len(entries)}
    OUT.write_text(json.dumps({"meta": meta, "entries": entries}, ensure_ascii=False, indent=1, sort_keys=True) + "\n", "utf8")
    c = {k: sum(1 for v in entries.values() if k in v) for k in ("pl", "fem", "mpl", "place")}
    print(f"wrote {OUT.relative_to(ROOT)}: {len(entries)} entries {c}")


if __name__ == "__main__":
    main()
