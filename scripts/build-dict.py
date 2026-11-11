#!/usr/bin/env python3
"""Offline dictionary for adding words the atlas does not have (卡组 → 自己添加).

Sources (all in references/, none shipped as is):
  Lexique 3.83 (lexique.org, CC BY-SA 4.0)   written form → lemma, part of speech, gender, pronunciation
  French Wiktionary via wiktextract           Chinese translations of French words, gender, IPA
     (kaikki.org/frwiktionary, CC BY-SA)      filtered by scripts/filter-wiktionary.py → references/wiktionary/
  Tatoeba (tatoeba.org, CC BY 2.0 FR)         French sentences with a Chinese translation, as examples
     references/tatoeba/{fra_sentences, cmn_sentences, fra-cmn_links}.tsv.bz2

Nothing is guessed: a field is filled only when a source gives it. Chinese sentences written in traditional
characters are converted with the character pairs Wiktionary itself gives (references/wiktionary/trad-simp.json);
a sentence that still has a character only seen as traditional is dropped.

Output: public/dict/<key>.json, key = the first two letters of the folded word ("ch", "a_" for a one-letter word,
        "__" when it does not start with a letter). Each file:
  {"f": {folded form: [folded lemma, ...]},     forms whose lemma is spelled differently
   "l": {folded lemma: [{"w", "p", "ipa"?, "zh"?: [[chinese, french sense label], ...], "ex"?: [[fr, zh, start, end], ...]}]}}
  "p" uses the atlas notation: n.m. n.f. n. v. adj. adv. prép. conj. pron. interj. loc.
  public/dict/meta.json  {sources, counts}
Usage:  python3 scripts/build-dict.py
"""
import bz2
import csv
import gzip
import json
import re
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "references"
OUT = ROOT / "public/dict"

PHON = {
    "a": "a", "A": "ɑ", "e": "e", "E": "ɛ", "i": "i", "o": "o", "O": "ɔ", "u": "u", "y": "y",
    "2": "ø", "9": "œ", "°": "ə", "@": "ɑ̃", "5": "ɛ̃", "1": "œ̃", "§": "ɔ̃",
    "8": "ɥ", "w": "w", "j": "j",
    "p": "p", "b": "b", "t": "t", "d": "d", "k": "k", "g": "g", "f": "f", "s": "s", "S": "ʃ",
    "v": "v", "z": "z", "Z": "ʒ", "m": "m", "n": "n", "N": "ɲ", "G": "ŋ", "l": "l", "R": "ʁ", "r": "ʁ", "x": "x",
}
LEX_POS = {"NOM": "n.", "VER": "v.", "AUX": "v.", "ADJ": "adj.", "ADV": "adv.", "PRE": "prép.", "CON": "conj.", "ONO": "interj."}
WIKI_POS = {"noun": "n.", "verb": "v.", "adj": "adj.", "adv": "adv.", "prep": "prép.", "conj": "conj.", "pron": "pron.", "intj": "interj.", "phrase": "loc.", "proverb": "loc."}
CONTENT = ("NOM", "VER", "ADJ", "ADV")
WORD = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*", re.UNICODE)


def nfc(s):
    return unicodedata.normalize("NFC", s)


def fold(s):
    """As the app's foldAccents: ligatures spelled out, accents removed, lower case."""
    s = nfc(s).lower().replace("œ", "oe").replace("æ", "ae").replace("’", "'")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def key(folded):
    letters = re.sub(r"[^a-z]", "", folded)
    if not letters or not folded[0].isalpha():
        return "__"
    return (letters + "_")[:2]


def ipa(code):
    out = []
    for ch in code:
        if ch in PHON:
            out.append(PHON[ch])
        elif ch not in "0-":
            return None
    return "".join(out)


def num(x):
    try:
        return float(x.replace(",", "."))
    except ValueError:
        return 0.0


def main():
    # ---------- Wiktionary ----------
    wiki = defaultdict(list)  # (folded word, pos) -> entries
    lig = {}  # folded spelling -> spelling with œ / æ (Lexique writes oe)
    for line in open(REF / "wiktionary/fr-zh.jsonl", encoding="utf-8"):
        d = json.loads(line)
        w = nfc(d["w"]).strip()
        p = WIKI_POS.get(d["pos"])
        if not w or not p or len(w) > 60:
            continue
        if p == "n." and d["g"] in ("m", "f"):
            p = "n.m." if d["g"] == "m" else "n.f."
        if "œ" in w or "æ" in w:
            lig[fold(w)] = w
        wiki[fold(w)].append({"w": w, "p": p, "ipa": d["ipa"].replace(".", "").replace("‿", ""), "tr": d["tr"]})
    trad = json.load(open(REF / "wiktionary/trad-simp.json", encoding="utf-8"))
    simp_chars = set(trad.values())
    trad_only = set(trad) - simp_chars

    # ---------- Lexique ----------
    lemmas = {}  # (folded lemma, pos) -> {"w", "p", "ipa", "freq"}
    forms = defaultdict(dict)  # folded form -> {folded lemma: freq}
    analysis = {}  # lower form -> (lemma, cgram) most frequent reading, for examples
    best = {}
    with gzip.open(REF / "lexique/Lexique383.tsv.gz", "rt", encoding="latin-1", newline="") as fh:
        rd = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
        col = {n.split("_", 1)[1]: i for i, n in enumerate(next(rd))}
        for r in rd:
            ortho = nfc(r[col["ortho"]]).lower()
            lemme = nfc(r[col["lemme"]]).lower()
            cg = r[col["cgram"]].split(":")[0]
            freq = num(r[col["freqfilms2"]]) + num(r[col["freqlivres"]])
            lfreq = num(r[col["freqlemfilms2"]]) + num(r[col["freqlemlivres"]])
            if best.get(ortho, -1) < freq:
                best[ortho] = freq
                analysis[ortho] = (lemme, cg)
            p = LEX_POS.get(cg)
            if not p:
                continue
            fl = fold(lemme)
            if p == "n.":
                g = r[col["genre"]]
                if ortho == lemme and g in ("m", "f"):
                    p = "n.m." if g == "m" else "n.f."
                else:
                    p = None  # gender is read from the lemma row
            if ortho == lemme and p:
                k = (fl, p)
                ph = ipa(r[col["phon"]])
                if k not in lemmas or lemmas[k]["freq"] < lfreq:
                    lemmas[k] = {"w": lig.get(fl, lemme), "p": p, "ipa": ph or "", "freq": lfreq}
            fo = fold(ortho)
            if fo != fl:
                forms[fo][fl] = max(forms[fo].get(fl, 0), freq)

    # ---------- merge: one record per (folded lemma, part of speech) ----------
    recs = {}
    for (fl, p), x in lemmas.items():
        recs[(fl, p)] = {"w": x["w"], "p": p, "ipa": x["ipa"], "freq": x["freq"]}
    for fw, items in wiki.items():
        for it in items:
            k = (fw, it["p"])
            if k not in recs:
                # Wiktionary noun without a gender, or a word Lexique lacks: match a Lexique noun of either gender
                alt = next((kk for kk in ((fw, "n.m."), (fw, "n.f.")) if it["p"] == "n." and kk in recs), None)
                k = alt or k
            rec = recs.setdefault(k, {"w": it["w"], "p": k[1], "ipa": it["ipa"], "freq": 0})
            if not rec["ipa"] and it["ipa"]:
                rec["ipa"] = it["ipa"]
            zh = rec.setdefault("zh", [])
            for word, label, _ in sorted(it["tr"], key=lambda t: t[2] or 99):
                if len(zh) < 8 and all(word != z[0] for z in zh):
                    zh.append([word, label])

    # ---------- Tatoeba examples ----------
    def read_sents(name):
        out = {}
        with bz2.open(REF / "tatoeba" / name, "rt", encoding="utf-8") as fh:
            for line in fh:
                parts = line.rstrip("\n").split("\t")
                if len(parts) >= 3:
                    out[parts[0]] = parts[2]
        return out

    fra = read_sents("fra_sentences.tsv.bz2")
    cmn = read_sents("cmn_sentences.tsv.bz2")
    pairs = {}
    dropped_trad = 0
    with bz2.open(REF / "tatoeba/fra-cmn_links.tsv.bz2", "rt", encoding="utf-8") as fh:
        for line in fh:
            a, b = line.split()
            if a not in fra or b not in cmn or a in pairs:
                continue
            zh = "".join(trad.get(c, c) for c in cmn[b])
            if any(c in trad_only for c in zh):
                dropped_trad += 1
                continue
            fr = nfc(fra[a]).strip()
            if 12 <= len(fr) <= 90 and len(zh) <= 60:
                pairs[a] = (fr, zh)
    # shorter, everyday sentences first; each lemma keeps two
    ordered = sorted(pairs.values(), key=lambda x: (abs(len(x[0]) - 40), x[0]))
    ex_count = defaultdict(int)
    examples = defaultdict(list)
    for fr, zh in ordered:
        used = set()
        for m in WORD.finditer(fr):
            tok = m.group().lower().replace("’", "'").replace("œ", "oe").replace("æ", "ae")
            a = analysis.get(tok)
            if not a or a[1] not in CONTENT:
                continue
            fl = fold(a[0])
            if fl in used or ex_count[fl] >= 2 or len(fl) < 3:
                continue
            used.add(fl)
            ex_count[fl] += 1
            # UTF-16 offsets, as JavaScript slices strings
            s = len(fr[: m.start()].encode("utf-16-le")) // 2
            e = s + len(m.group().encode("utf-16-le")) // 2
            examples[fl].append([fr, zh, s, e])

    # ---------- write per-key files ----------
    files = defaultdict(lambda: {"f": {}, "l": {}})
    by_lemma = defaultdict(list)
    for (fl, p), rec in recs.items():
        by_lemma[fl].append(rec)
    kept = 0
    for fl, rs in by_lemma.items():
        rs.sort(key=lambda r: (-("zh" in r), -r["freq"]))
        out = []
        for r in rs[:4]:
            # rare Lexique lemmas with nothing to offer but a spelling are left out
            if "zh" not in r and r["freq"] < 0.05:
                continue
            item = {"w": r["w"], "p": r["p"]}
            if r["ipa"]:
                item["ipa"] = r["ipa"]
            if r.get("zh"):
                item["zh"] = r["zh"]
            out.append(item)
        if not out:
            continue
        if examples.get(fl):
            out[0]["ex"] = examples[fl]
        files[key(fl)]["l"][fl] = out
        kept += 1
    for fo, ls in forms.items():
        # kept even when the folded spelling is a lemma too: bâille (bâiller) folds to baille (a noun)
        targets = [fl for fl, _ in sorted(ls.items(), key=lambda x: -x[1]) if fl != fo and key(fl) in files and fl in files[key(fl)]["l"]]
        if targets:
            files[key(fo)]["f"][fo] = targets[:3]
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    total = 0
    for k, data in files.items():
        p = OUT / f"{k}.json"
        p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        total += p.stat().st_size
    meta = {
        "generated": date.today().isoformat(),
        "sources": {
            "lexique": "Lexique 3.83, www.lexique.org, CC BY-SA 4.0",
            "wiktionary": "Wiktionnaire (fr.wiktionary.org) via wiktextract / kaikki.org, CC BY-SA 4.0",
            "tatoeba": "Tatoeba (tatoeba.org), CC BY 2.0 FR",
        },
        "lemmas": kept,
        "withChinese": sum(1 for rs in by_lemma.values() for r in rs[:1] if r.get("zh")),
        "withExamples": len(examples),
        "examplePairs": len(pairs),
        "droppedTraditional": dropped_trad,
        "files": len(files),
        "bytes": total,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(meta)


main()
