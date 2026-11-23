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
import sqlite3
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
ELIDED = {
    "l": "l", "d": "d", "j": "ʒ", "m": "m", "t": "t", "s": "s", "n": "n", "c": "s",
    "qu": "k", "jusqu": "ʒysk", "lorsqu": "lɔʁsk", "puisqu": "pɥisk", "quoiqu": "kwak",
    "quelqu": "kɛlk", "aujourd": "oʒuʁd",
}
LETTER_IPA = {
    "a": "a", "b": "be", "c": "se", "d": "de", "e": "ø", "f": "ɛf", "g": "ʒe",
    "h": "aʃ", "i": "i", "j": "ʒi", "k": "ka", "l": "ɛl", "m": "ɛm", "n": "ɛn",
    "o": "o", "p": "pe", "q": "ky", "r": "ɛʁ", "s": "ɛs", "t": "te", "u": "y",
    "v": "ve", "w": "dubləve", "x": "iks", "y": "igʁɛk", "z": "zɛd",
}
SPECIAL_WORDS_IPA = {
    "samu": "samy",
    "smic": "smik",
    "erasmus": "eʁasmys",
    "co2": "se o dø",
    "sciences-po": "sjɑ̃s po",
    "normale sup": "nɔʁmal syp",
    "wifi": "wifi",
}
OVERRIDES_FILE = ROOT / "data/ipa-overrides.json"


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
        if len(w) < 3:
            return None
        ps = self.folded.get(fold(w.replace("œ", "oe")))
        return next(iter(ps)) if ps and len(ps) == 1 else None


def load_lexdb_ipa(db_path):
    if not db_path.exists():
        return {}
    out = {}
    conn = sqlite3.connect(str(db_path))
    try:
        for w, p in conn.execute("SELECT lower(w), ipa FROM lemma WHERE ipa IS NOT NULL AND ipa != ''"):
            clean = str(p).strip().strip("/")
            if clean:
                out.setdefault(nfc(w), clean)
    finally:
        conn.close()
    return out


def spell_acronym(tok):
    letters = re.sub(r"[^a-z]", "", tok.lower())
    if not letters or len(letters) > 6:
        return None
    if not all(ch in LETTER_IPA for ch in letters):
        return None
    return " ".join(LETTER_IPA[ch] for ch in letters)


def normalize_for_ipa(lemma):
    raw = re.sub(r"\([^)]*\)", "", nfc(lemma)).replace("’", "'").strip()
    if not raw:
        return "", ""
    # Strip editorial template markers ("... €", "+ inf", punctuation) before token lookup
    cleaned = raw.replace("...", " ").replace("€", " ").replace("+ inf", " ")
    cleaned = re.sub(r"[,;?!]+", " ", cleaned)
    # Collapse feminine slash suffix variants like "curieux/euse", "cyberdépendant/e" to the base masculine form
    cleaned = re.sub(r"/[a-zàâäçéèêëîïôöùûüÿœæ]+\b", "", cleaned, flags=re.IGNORECASE)
    # Replace pedagogical placeholders qe/qo/qc/qqch/qn with natural French pronouns
    cleaned = re.sub(r"\b(?:qqch|qc|qe|qo)\b", "quelque chose", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\b(?:qqn|qn)\b", "quelqu'un", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return raw.lower(), cleaned


def transcribe(lex, lemma, pos, lexdb_ipa=None, overrides=None, entry_id=None, _depth=0):
    if _depth == 0 and overrides and entry_id and entry_id in overrides:
        return overrides[entry_id], "override"
    orig_lower, text_cased = normalize_for_ipa(lemma)
    if not text_cased:
        return None
    text = text_cased.lower()
    if orig_lower in SPECIAL_WORDS_IPA:
        return SPECIAL_WORDS_IPA[orig_lower], "override"
    if _depth == 0 and " / " in orig_lower or (_depth == 0 and "=" in orig_lower):
        for sep in ("/", "="):
            if sep in orig_lower:
                sides = [s.strip() for s in orig_lower.split(sep) if s.strip()]
                if len(sides) >= 2:
                    res = [transcribe(lex, s, pos, lexdb_ipa, None, None, 1) for s in sides]
                    if all(res):
                        return f" {sep} ".join(r[0] for r in res), "compound"
                return None
    if re.search(r"[^a-zàâäçéèêëîïôöùûüÿœæ0-9.' \-]", text):
        return None
    # Dotted or pure uppercase acronyms (B.U., P. V., D.A.B., ADN, CDD, PME...)
    if re.fullmatch(r"[A-ZÉÀÈ.](?:[.\-\s]?[A-ZÉÀÈ]){0,7}\.?", text_cased) and len(re.sub(r"[^A-Z]", "", text_cased)) >= 1:
        if text in SPECIAL_WORDS_IPA:
            return SPECIAL_WORDS_IPA[text], "override"
        spelled = spell_acronym(text)
        if spelled:
            return spelled, "acronym"
    text_nodots = re.sub(r"\.", "", text)
    if text_nodots in SPECIAL_WORDS_IPA:
        return SPECIAL_WORDS_IPA[text_nodots], "override"
    tags = POS_MAP.get(pos, ())
    whole = lex.word(text_nodots, tags)
    if whole and " " not in text_nodots:
        return whole, "word"
    if lexdb_ipa and text_nodots in lexdb_ipa:
        return lexdb_ipa[text_nodots], "lexdb"
    parts = []
    for raw_tok in re.findall(r"[^ ']+'?|'", text_cased.replace("-", " ")):
        tok_low = re.sub(r"\.", "", raw_tok.lower()).strip()
        if not tok_low or tok_low == "'":
            continue
        if tok_low in SPECIAL_WORDS_IPA:
            parts.append(("word", SPECIAL_WORDS_IPA[tok_low]))
            continue
        if raw_tok.isupper() and len(tok_low) <= 6:
            sp = spell_acronym(tok_low)
            if sp:
                parts.append(("word", sp))
                continue
        if tok_low.endswith("'"):
            p = ELIDED.get(tok_low[:-1])
            if p is None:
                return None
            parts.append(("elide", p))
            continue
        p = lex.word(tok_low) or (lexdb_ipa.get(tok_low) if lexdb_ipa else None) or lex.folded_word(tok_low)
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


def load_overrides():
    if not OVERRIDES_FILE.exists():
        return {}
    raw = json.loads(OVERRIDES_FILE.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v).strip().strip("/") for k, v in raw.items() if str(v).strip()}


def main():
    lex = Lex(LEXIQUE)
    lexdb_ipa = load_lexdb_ipa(ROOT / "data/lexdb/lexdb.sqlite")
    overrides = load_overrides()
    lexicon = json.load(open(ROOT / "data/lexicon.json", encoding="utf-8"))["entries"]
    entries, missing, counts = {}, [], defaultdict(int)
    for e in lexicon:
        if e.get("aliasOf"):
            continue
        r = transcribe(lex, e["lemma"], e["pos"], lexdb_ipa, overrides, e["id"])
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
