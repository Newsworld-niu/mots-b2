#!/usr/bin/env python3
"""Noun gender and article for every noun entry, for display and the un/une quiz.

Input:  data/lexicon.json (gender comes from the entry's part of speech: n.m. / n.f. / n.m./f.)
        references/lexique/Lexique383.tsv.gz (Lexique 3.83, CC BY-SA 4.0) as an independent check
Output: data/nouns.json                 {meta, entries: {id: {"g", "art", "check"}}}
        data/gaps/gender-conflicts.csv   nouns whose gender disagrees with Lexique (not quizzed)
        data/gaps/noun-pos-suspect.csv   nouns that Lexique mostly uses as another part of speech
                                         (oui, deux, ton…): review list only, quiz unchanged —
                                         most are real homograph nouns (un devoir, un son)

Fields
  g      "m" | "f" | "mf" (both genders: un/une élève)
  art    indefinite article shown before the headword: "un" | "une" | "un/une" | "des"
         The indefinite article is used everywhere because it always shows the gender:
         the definite article hides it before a vowel (l'école) and depends on h aspiré.
         "des" marks headwords that are plural forms (vacances, lunettes): no gender quiz.
  check  "lexique"  Lexique gives the same gender
         "conflict" Lexique gives only the other gender -> listed for review, never quizzed
         "unknown"  not in Lexique (expressions, rare words); gender from the lexicon only
         "proper"   proper noun or acronym (Canada, CAPES): no indefinite article, never quizzed
         "has-article" headword already starts with an article (le cours): never quizzed
         "function-word" Lexique knows the word only as a grammatical word (oui, deux, mais): the
                    entry is mis-tagged or mis-spelled (mais = maïs); no article shown, never quizzed

Usage: python3 scripts/build-nouns.py
"""
import csv
import gzip
import json
import re
import unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEXIQUE = ROOT / "references/lexique/Lexique383.tsv.gz"
GENDER = {"n.m.": "m", "n.f.": "f", "n.m./f.": "mf"}
ARTICLE = {"m": "un", "f": "une", "mf": "un/une"}


def key(s: str) -> str:
    return unicodedata.normalize("NFC", s).strip().lower().replace("’", "'").replace("œ", "oe").replace("æ", "ae")


NOUN_SHARE_MIN = 0.2  # below this share of the word's lemma frequency, "noun" is a minor use


def load_lexique():
    """Singular / plural-form genders per written form, and the noun share of each lemma's frequency."""
    sing: dict[str, set[str]] = {}
    plural: dict[str, set[str]] = {}
    lemfreq: dict[str, dict[str, float]] = {}
    tags: dict[str, set[str]] = {}
    with gzip.open(LEXIQUE, "rt", encoding="latin-1", newline="") as fh:
        rd = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
        head = next(rd)
        col = {n.split("_", 1)[1]: i for i, n in enumerate(head)}
        for row in rd:
            ortho, lemme = row[col["ortho"]].lower(), row[col["lemme"]].lower()
            fl = sum(float(row[col[k]].replace(",", ".") or 0) for k in ("freqlemfilms2", "freqlemlivres")) / 2
            tags.setdefault(ortho, set()).add(row[col["cgram"]])
            per = lemfreq.setdefault(lemme, {})
            per[row[col["cgram"]]] = max(per.get(row[col["cgram"]], 0.0), fl)
            if row[col["cgram"]] != "NOM":
                continue
            genre, nombre = row[col["genre"]], row[col["nombre"]]
            g = {genre} if genre in ("m", "f") else set()
            if nombre == "p" and ortho != lemme:
                plural.setdefault(ortho, set()).update(g)
            else:
                sing.setdefault(ortho, set()).update(g)
    share = {lem: (per.get("NOM", 0.0) / total) for lem, per in lemfreq.items() if (total := sum(per.values())) > 0}
    return sing, plural, share, tags


def main():
    lex = json.loads((ROOT / "data/lexicon.json").read_text(encoding="utf-8"))
    sing, plural, share, tags = load_lexique()
    out, conflicts, suspect = {}, [], []
    counts: dict[str, int] = {}
    for e in lex["entries"]:
        g = GENDER.get(e["pos"])
        if not g:
            continue
        w = key(e["lemma"])
        art = ARTICLE[g]
        if e["lemma"].strip()[:1].isupper():
            check, art = "proper", ""
        elif re.match(r"^(le|la|les|un|une|des)\s|^l'", w):
            check, art = "has-article", ""
        elif w in tags and not (tags[w] & {"NOM", "ADJ", "VER", "AUX"}):
            check, art = "function-word", ""
        elif " " in w or w not in sing and w not in plural:
            check = "unknown"
        else:
            if w not in sing and w in plural:
                art = "des"  # headword is a plural form
            lg = sing.get(w) or plural.get(w) or set()
            if not lg or g == "mf" or g in lg:
                check = "lexique" if lg and (g in lg or g == "mf") else "unknown"
            else:
                check = "conflict"
                if not e.get("aliasOf"):
                    conflicts.append((e, "".join(sorted(lg))))
        out[e["id"]] = {"g": g, "art": art, "check": check}
        if not e.get("aliasOf") and w in share and share[w] < NOUN_SHARE_MIN:
            suspect.append((e, share[w]))
        counts[check] = counts.get(check, 0) + 1
        if art == "des":
            counts["plural-headword"] = counts.get("plural-headword", 0) + 1
    meta = {
        "source": "gender from data/lexicon.json (pos); checked against Lexique 3.83 (CC BY-SA 4.0)",
        "counts": dict(sorted(counts.items())),
        "generated": date.today().isoformat(),
        "script": "scripts/build-nouns.py",
    }
    (ROOT / "data/nouns.json").write_text(
        json.dumps({"meta": meta, "entries": out}, ensure_ascii=False, indent=0, sort_keys=True) + "\n", encoding="utf-8")
    gaps = ROOT / "data/gaps"
    gaps.mkdir(parents=True, exist_ok=True)
    with (gaps / "gender-conflicts.csv").open("w", encoding="utf-8", newline="") as fh:
        wr = csv.writer(fh)
        wr.writerow(["id", "lemma", "pos", "lexique_gender", "zh"])
        for e, lg in conflicts:
            zh = next((s["zh"] for s in e["senses"] if s["zh"]), "")
            wr.writerow([e["id"], e["lemma"], e["pos"], lg, zh])
    with (gaps / "noun-pos-suspect.csv").open("w", encoding="utf-8", newline="") as fh:
        wr = csv.writer(fh)
        wr.writerow(["id", "lemma", "pos", "noun_share_in_lexique", "zh"])
        for e, sh in suspect:
            zh = next((s["zh"] for s in e["senses"] if s["zh"]), "")
            wr.writerow([e["id"], e["lemma"], e["pos"], f"{sh:.3f}", zh])
    print(f"nouns: {len(out)} entries; {meta['counts']}; conflicts listed: {len(conflicts)}; pos-suspect listed: {len(suspect)}")


if __name__ == "__main__":
    main()
