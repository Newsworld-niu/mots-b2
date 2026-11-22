#!/usr/bin/env python3
"""Build data/lexdb/lexdb.sqlite from Lexique 3.83, Mots B2 Atlas, fr.wiktionary, zh.wiktionary, CFDICT, OMW, and Tatoeba.

Usage:
  python3 scripts/lexdb/build-db.py [--db data/lexdb/lexdb.sqlite] [--skip-raw]
"""
from __future__ import annotations

import argparse
import bz2
import csv
import gzip
import json
import re
import sqlite3
import subprocess
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (
    LEX_POS,
    OMW_POS,
    ROOT,
    WIKI_POS,
    WORD_RE,
    has_cjk,
    lexdb_fold,
    lexique_to_ipa,
    load_trad_simp,
    nfc,
    normalize_zh_display,
    parse_num,
    resolve_ref,
    to_simp,
    utf16_offset,
    zh_tokens,
)

DEFAULT_DB = ROOT / "data/lexdb/lexdb.sqlite"

REG_TAGS = [
    ({"literary", "formal", "poetic", "elevated", "soutenu"}, "书"),
    ({"informal", "colloquial", "familiar", "slang", "vulgar", "pejorative", "familier"}, "俗"),
    ({"archaic", "dated", "obsolete", "vieilli"}, "旧"),
    ({"figuratively", "figurative", "figuré"}, "转"),
    (
        {
            "technical", "medicine", "medical", "law", "legal", "computing", "chemistry",
            "physics", "biology", "botany", "zoology", "mathematics", "music", "linguistics",
            "anatomy", "astronomy", "architecture", "economics", "finance", "grammar",
        },
        "技",
    ),
    ({"regional", "dialectal", "canada", "quebec", "belgium", "switzerland"}, "省"),
]

CFDICT_NOISE_RE = re.compile(
    r"(?:^\([^)]*\)$|\b(?:radical|classificateur|nom de famille|patronyme|prénom|dialecte|abr\.|var\.|arch\.|ethnie|dynastie|ère|canton|xian|préfecture|province)\b)",
    re.I,
)
ZHWIKT_TEMPLATE_RE = re.compile(r"^:?(?:Template|模板):[^\s]+\s*")


def extract_reg(tags: list[str] | None, raw_tags: list[str] | None = None) -> str | None:
    pool = {str(t).strip().lower() for t in (tags or []) + (raw_tags or []) if t}
    for keys, label in REG_TAGS:
        if pool & keys:
            return label
    return None


def norm_atlas_pos(pos: str) -> tuple[str, str | None]:
    p = pos.strip()
    if p == "n.m.":
        return "n.m.", "m"
    if p == "n.f.":
        return "n.f.", "f"
    if p == "n.m./f.":
        return "n.", "mf"
    if p == "loc. adv.":
        return "loc.", None
    if p in ("n.", "v.", "adj.", "adv.", "prép.", "conj.", "pron.", "interj.", "loc."):
        return p, None
    return "loc." if " " in p else "n.", None


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        DROP TABLE IF EXISTS report;
        DROP TABLE IF EXISTS review_flag;
        DROP TABLE IF EXISTS ai_job;
        DROP TABLE IF EXISTS etym;
        DROP TABLE IF EXISTS fr_def;
        DROP TABLE IF EXISTS form;
        DROP TABLE IF EXISTS relation;
        DROP TABLE IF EXISTS phrase;
        DROP TABLE IF EXISTS example;
        DROP TABLE IF EXISTS gloss;
        DROP TABLE IF EXISTS sense;
        DROP TABLE IF EXISTS pos_block;
        DROP TABLE IF EXISTS lemma;

        CREATE TABLE lemma (
            id TEXT PRIMARY KEY,
            w TEXT NOT NULL,
            folded TEXT NOT NULL,
            ipa TEXT,
            level TEXT,
            rank INTEGER,
            freq REAL DEFAULT 0,
            atlas_id TEXT,
            conj INTEGER NOT NULL DEFAULT 0,
            family TEXT,
            is_phrase INTEGER NOT NULL DEFAULT 0,
            sources_json TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE pos_block (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            p TEXT NOT NULL,
            g TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            UNIQUE(lemma_id, p)
        );

        CREATE TABLE sense (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pos_block_id INTEGER NOT NULL REFERENCES pos_block(id) ON DELETE CASCADE,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            fr TEXT,
            reg TEXT,
            zh_merged TEXT NOT NULL DEFAULT '',
            src_json TEXT NOT NULL DEFAULT '[]',
            conf INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE gloss (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sense_id INTEGER REFERENCES sense(id) ON DELETE SET NULL,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            pos TEXT NOT NULL,
            zh TEXT NOT NULL,
            zh_norm TEXT NOT NULL,
            fr_label TEXT,
            src TEXT NOT NULL,
            conf INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE example (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            sense_id INTEGER REFERENCES sense(id) ON DELETE SET NULL,
            pos TEXT,
            fr TEXT NOT NULL,
            zh TEXT NOT NULL DEFAULT '',
            hl_start INTEGER,
            hl_end INTEGER,
            src TEXT NOT NULL,
            ref TEXT
        );

        CREATE TABLE phrase (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            fr TEXT NOT NULL,
            zh TEXT NOT NULL DEFAULT '',
            src TEXT NOT NULL,
            conf INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE relation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            target TEXT NOT NULL,
            src TEXT NOT NULL
        );

        CREATE TABLE form (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            form TEXT NOT NULL,
            folded_form TEXT NOT NULL,
            tag TEXT NOT NULL,
            freq REAL NOT NULL DEFAULT 0
        );

        CREATE TABLE fr_def (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            p TEXT NOT NULL,
            gloss TEXT NOT NULL,
            ex TEXT,
            reg TEXT,
            src TEXT NOT NULL DEFAULT 'wikt-fr'
        );

        CREATE TABLE etym (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            src TEXT NOT NULL DEFAULT 'wikt-fr'
        );

        CREATE TABLE ai_job (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL UNIQUE REFERENCES lemma(id) ON DELETE CASCADE,
            tier TEXT NOT NULL,
            needs TEXT NOT NULL DEFAULT '',
            gen_status TEXT NOT NULL DEFAULT 'pending',
            review_status TEXT NOT NULL DEFAULT 'pending',
            gen_model TEXT,
            review_model TEXT,
            result_json TEXT,
            review_json TEXT,
            updated_at TEXT
        );

        CREATE TABLE review_flag (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lemma_id TEXT NOT NULL REFERENCES lemma(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            detail TEXT NOT NULL,
            resolved INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE report (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE INDEX idx_lemma_folded ON lemma(folded);
        CREATE INDEX idx_lemma_rank ON lemma(rank);
        CREATE INDEX idx_lemma_atlas ON lemma(atlas_id);
        CREATE INDEX idx_pos_lemma ON pos_block(lemma_id);
        CREATE INDEX idx_sense_lemma ON sense(lemma_id);
        CREATE INDEX idx_sense_pb ON sense(pos_block_id);
        CREATE INDEX idx_gloss_lemma ON gloss(lemma_id);
        CREATE INDEX idx_gloss_sense ON gloss(sense_id);
        CREATE INDEX idx_example_lemma ON example(lemma_id);
        CREATE INDEX idx_phrase_lemma ON phrase(lemma_id);
        CREATE INDEX idx_rel_lemma ON relation(lemma_id);
        CREATE INDEX idx_form_lemma ON form(lemma_id);
        CREATE INDEX idx_form_folded ON form(folded_form);
        CREATE INDEX idx_frdef_lemma ON fr_def(lemma_id);
        CREATE INDEX idx_etym_lemma ON etym(lemma_id);
        CREATE INDEX idx_ai_tier_status ON ai_job(tier, gen_status);
        CREATE INDEX idx_flag_lemma ON review_flag(lemma_id);
        """
    )


def load_fr_zh(trad_map: dict[str, str]):
    """Load references/wiktionary/fr-zh.jsonl keyed by (canonical lower w, pos)."""
    path = resolve_ref("references/wiktionary/fr-zh.jsonl")
    by_wp: dict[tuple[str, str], list[dict]] = defaultdict(list)
    by_fold_p: dict[tuple[str, str], list[dict]] = defaultdict(list)
    lig: dict[str, str] = {}
    wiki_folded: set[str] = set()
    if not path.exists():
        return by_wp, by_fold_p, lig, wiki_folded
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            d = json.loads(line)
            w = nfc(d.get("w", "")).strip()
            p = WIKI_POS.get(d.get("pos", ""))
            if not w or not p or len(w) > 60:
                continue
            if p == "n." and d.get("g") in ("m", "f"):
                p = "n.m." if d["g"] == "m" else "n.f."
            fw = lexdb_fold(w)
            wiki_folded.add(fw)
            if "œ" in w or "æ" in w:
                lig[fw] = w
            cleaned_tr = []
            for word, label, idx in d.get("tr") or []:
                zh = normalize_zh_display(word, trad_map)
                if zh and has_cjk(zh):
                    cleaned_tr.append((zh, (label or "").strip(), idx or 0))
            if not cleaned_tr:
                continue
            rec = {
                "w": w,
                "p": p,
                "ipa": (d.get("ipa") or "").replace(".", "").replace("‿", ""),
                "tr": cleaned_tr,
            }
            by_wp[(w.lower(), p)].append(rec)
            by_fold_p[(fw, p)].append(rec)
    return by_wp, by_fold_p, lig, wiki_folded


def load_lexique(lig: dict[str, str], wiki_folded: set[str]):
    """Read Lexique383.tsv.gz once and return lemma records, forms, IPA, and analysis maps."""
    path = resolve_ref("references/lexique/Lexique383.tsv.gz")
    # Build same base 38,805 filter as scripts/build-dict.py, plus keep full Lexique rows for any matched lemma
    dict_lemmas: dict[tuple[str, str], dict] = {}
    all_lemmas_by_w: dict[str, dict] = {}  # w.lower() -> {w, ipa, freq, pos_set}
    forms_by_w: dict[str, list[tuple[str, str, str, str, float]]] = defaultdict(list)
    analysis: dict[str, tuple[str, str]] = {}
    best_ortho_freq: dict[str, float] = {}
    ortho_to_lemmas: dict[str, set[tuple[str, str]]] = defaultdict(set)

    with gzip.open(path, "rt", encoding="latin-1", newline="") as fh:
        rd = csv.reader(fh, delimiter="\t", quoting=csv.QUOTE_NONE)
        col = {n.split("_", 1)[1]: i for i, n in enumerate(next(rd))}
        for r in rd:
            ortho = nfc(r[col["ortho"]]).lower()
            lemme = nfc(r[col["lemme"]]).lower()
            cg_full = r[col["cgram"]]
            cg = cg_full.split(":")[0]
            genre = r[col["genre"]]
            nombre = r[col["nombre"]]
            freq = parse_num(r[col["freqfilms2"]]) + parse_num(r[col["freqlivres"]])
            lfreq = parse_num(r[col["freqlemfilms2"]]) + parse_num(r[col["freqlemlivres"]])
            ph = lexique_to_ipa(r[col["phon"]]) or ""

            if best_ortho_freq.get(ortho, -1) < freq:
                best_ortho_freq[ortho] = freq
                analysis[ortho] = (lemme, cg)
            ortho_to_lemmas[ortho].add((lemme, cg_full))

            fl = lexdb_fold(lemme)
            w_show = lig.get(fl, lemme)
            p_raw = LEX_POS.get(cg)
            if not p_raw:
                continue

            if ortho != lemme or freq > 0:
                forms_by_w[lemme].append((ortho, cg, genre, nombre, freq))

            # Full Lexique index (including epicene/empty-gender nouns for atlas words)
            p_full = p_raw
            if p_full == "n." and genre in ("m", "f"):
                p_full = "n.m." if genre == "m" else "n.f."
            if ortho == lemme:
                entry = all_lemmas_by_w.setdefault(
                    lemme,
                    {"w": w_show, "folded": fl, "ipa": ph, "freq": lfreq, "pos_freq": defaultdict(float)},
                )
                if lfreq > entry["freq"]:
                    entry["freq"] = lfreq
                    if ph:
                        entry["ipa"] = ph
                if not entry["ipa"] and ph:
                    entry["ipa"] = ph
                entry["pos_freq"][p_full] = max(entry["pos_freq"][p_full], lfreq)

            # Strict build-dict.py POS filter for the 38,805 base set
            p_dict = p_raw if cg != "PRO" else None
            if p_dict == "n.":
                if ortho == lemme and genre in ("m", "f"):
                    p_dict = "n.m." if genre == "m" else "n.f."
                else:
                    p_dict = None
            if ortho == lemme and p_dict:
                if lfreq >= 0.05 or fl in wiki_folded:
                    k = (lemme, p_dict)
                    if k not in dict_lemmas or dict_lemmas[k]["freq"] < lfreq:
                        dict_lemmas[k] = {"w": w_show, "folded": fl, "p": p_dict, "ipa": ph, "freq": lfreq}

    return dict_lemmas, all_lemmas_by_w, forms_by_w, analysis, ortho_to_lemmas


def load_atlas_data():
    idx = json.loads((ROOT / "public/atlas/index.json").read_text(encoding="utf-8"))
    idx_level: dict[str, str] = {}
    idx_order: dict[str, int] = {}
    cefr = idx["cefr"]
    for i, row in enumerate(idx["words"]):
        aid = row[0]
        lvl = cefr[row[4]] if 0 <= row[4] < len(cefr) else ""
        if lvl in ("A1", "A2", "B1", "B2"):
            idx_level[aid] = lvl
        idx_order[aid] = i

    lex = json.loads((ROOT / "data/lexicon.json").read_text(encoding="utf-8"))["entries"]
    visible = [e for e in lex if not e.get("aliasOf")]

    freq_data = json.loads((ROOT / "data/frequency.json").read_text(encoding="utf-8"))["entries"]
    hl_data = json.loads((ROOT / "data/highlights.json").read_text(encoding="utf-8"))["entries"]
    conj_data = json.loads((ROOT / "public/atlas/conj.json").read_text(encoding="utf-8"))["verbs"]
    fam_data = json.loads((ROOT / "src/data/families.json").read_text(encoding="utf-8"))
    cf_data = json.loads((ROOT / "data/confusables.json").read_text(encoding="utf-8"))["groups"]
    ipa_data = json.loads((ROOT / "data/ipa.json").read_text(encoding="utf-8"))["entries"]
    forms_data = json.loads((ROOT / "data/forms.json").read_text(encoding="utf-8"))["entries"]
    nouns_data = json.loads((ROOT / "data/nouns.json").read_text(encoding="utf-8"))["entries"]

    return {
        "idx_level": idx_level,
        "idx_order": idx_order,
        "visible": visible,
        "freq": freq_data,
        "hl": hl_data,
        "conj": conj_data,
        "families": fam_data,
        "confusables": cf_data,
        "ipa": ipa_data,
        "forms": forms_data,
        "nouns": nouns_data,
    }


def extract_bold_hl(text: str, offsets: list | None) -> tuple[int, int] | None:
    if not offsets or not isinstance(offsets, list):
        return None
    first = offsets[0]
    if isinstance(first, list) and len(first) == 2:
        a, b = first
        if isinstance(a, int) and isinstance(b, int) and 0 <= a < b <= len(text):
            return utf16_offset(text, a), utf16_offset(text, b)
    return None


def find_lexique_hl(sentence: str, target_words: set[str], target_folded: set[str], ortho_to_lemmas: dict[str, set[tuple[str, str]]]) -> tuple[int, int] | None:
    for m in WORD_RE.finditer(sentence):
        tok = nfc(m.group()).lower().replace("’", "'")
        tok_lx = tok.replace("œ", "oe").replace("æ", "ae")
        if tok in target_words or tok_lx in target_words or lexdb_fold(tok) in target_folded:
            return utf16_offset(sentence, m.start()), utf16_offset(sentence, m.end())
        for lm, _ in ortho_to_lemmas.get(tok_lx, ()):
            if lm in target_words or lexdb_fold(lm) in target_folded:
                return utf16_offset(sentence, m.start()), utf16_offset(sentence, m.end())
    return None


def stream_wikt_fr(target_w_lower: set[str], ortho_to_lemmas: dict[str, set[tuple[str, str]]]):
    """Stream references/wiktionary-raw/raw.jsonl.gz in ONE pass for target French lemmas."""
    path = resolve_ref("references/wiktionary-raw/raw.jsonl.gz")
    out = {
        "fr_defs": defaultdict(list),   # w_lower -> [(p, gloss, ex, reg)]
        "etym": defaultdict(list),      # w_lower -> [text]
        "forms": defaultdict(list),     # w_lower -> [(form, tag)]
        "syn": defaultdict(list),       # w_lower -> [word]
        "ant": defaultdict(list),       # w_lower -> [word]
        "derived": defaultdict(list),   # w_lower -> [word]
        "examples": defaultdict(list),  # w_lower -> [(p, fr, hl_start, hl_end, ref)]
        "pos_tags": defaultdict(set),   # w_lower -> {(p, g)}
    }
    if not path.exists():
        print(f"Warning: {path} not found, skipping raw fr.wiktionary stream", flush=True)
        return out

    print(f"[raw] streaming {path} in one pass...", flush=True)
    t0 = time.time()
    proc = subprocess.Popen(["gzip", "-dc", str(path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None and proc.stderr is not None

    total = matched = 0
    for raw in proc.stdout:
        total += 1
        if b'"lang_code": "fr"' not in raw and b'"lang_code":"fr"' not in raw:
            continue
        # Fast pre-extract word before json.loads
        i = raw.find(b'"word": "')
        if i >= 0:
            j = raw.find(b'"', i + 9)
            if j > i and b"\\" not in raw[i + 9 : j]:
                w_cand = nfc(raw[i + 9 : j].decode("utf-8", "ignore")).strip().lower()
                if w_cand not in target_w_lower:
                    continue
        try:
            d = json.loads(raw)
        except ValueError:
            continue
        if d.get("lang_code") != "fr":
            continue
        w = nfc(d.get("word") or "").strip()
        wl = w.lower()
        if wl not in target_w_lower:
            continue
        matched += 1

        raw_pos = d.get("pos", "")
        p = WIKI_POS.get(raw_pos)
        if not p:
            continue
        tags = set(d.get("tags") or [])
        g = None
        if p == "n.":
            if {"masculine", "feminine"} <= tags:
                g = "mf"
            elif "masculine" in tags:
                p, g = "n.m.", "m"
            elif "feminine" in tags:
                p, g = "n.f.", "f"
        out["pos_tags"][wl].add((p, g))

        for et in d.get("etymology_texts") or []:
            et_s = nfc(et).strip()
            if et_s and et_s not in out["etym"][wl] and len(out["etym"][wl]) < 2:
                out["etym"][wl].append(et_s[:500])

        for fm in d.get("forms") or []:
            form_str = nfc(fm.get("form") or "").strip()
            if not form_str or form_str.lower() == wl or len(form_str) > 60:
                continue
            ftags = set(fm.get("tags") or [])
            if {"masculine", "feminine", "plural", "singular"} & ftags:
                if "singular" in ftags and "feminine" in ftags:
                    out["forms"][wl].append((form_str, "f"))
                elif "plural" in ftags and "feminine" in ftags:
                    out["forms"][wl].append((form_str, "fpl"))
                elif "plural" in ftags:
                    out["forms"][wl].append((form_str, "pl"))
            elif "table-tags" not in ftags and "infinitive" not in ftags and "gerund" not in ftags:
                if not any(x in ftags for x in ("past-participle", "present-participle")):
                    continue
                out["forms"][wl].append((form_str, "infl"))

        def collect_rel(items, target_list, limit=25):
            for it in items or []:
                rw = nfc(it.get("word") or "").strip()
                if rw and rw.lower() != wl and len(rw) <= 60 and rw not in target_list:
                    target_list.append(rw)
                    if len(target_list) >= limit:
                        return

        collect_rel(d.get("synonyms"), out["syn"][wl], 15)
        collect_rel(d.get("antonyms"), out["ant"][wl], 15)
        collect_rel(d.get("derived"), out["derived"][wl], 25)

        wf = lexdb_fold(w)
        for s in d.get("senses") or []:
            stags = s.get("tags") or []
            if "form-of" in stags or s.get("form_of"):
                continue
            glosses = s.get("glosses") or []
            if not glosses:
                continue
            gloss_txt = nfc(glosses[-1]).strip()
            if not gloss_txt or len(gloss_txt) > 350:
                continue
            # Skip pure toponym/demonym filler when general senses already exist
            if "commune française" in gloss_txt and len(out["fr_defs"][wl]) >= 1:
                continue
            reg = extract_reg(stags, s.get("raw_tags"))
            ex_first = None
            for ex in s.get("examples") or []:
                ex_txt = nfc(ex.get("text") or "").strip()
                if not ex_txt or len(ex_txt) > 260:
                    continue
                if ex_first is None:
                    ex_first = ex_txt
                hl = extract_bold_hl(ex_txt, ex.get("bold_text_offsets"))
                if hl is None:
                    hl = find_lexique_hl(ex_txt, {wl}, {wf}, ortho_to_lemmas)
                ref = nfc(ex.get("ref") or "").strip()[:120] or None
                if len(out["examples"][wl]) < 8:
                    out["examples"][wl].append((p, ex_txt, hl[0] if hl else None, hl[1] if hl else None, ref))
            if len(out["fr_defs"][wl]) < 12:
                out["fr_defs"][wl].append((p, gloss_txt, ex_first, reg))
            collect_rel(s.get("synonyms"), out["syn"][wl], 15)
            collect_rel(s.get("antonyms"), out["ant"][wl], 15)

    rc = proc.wait()
    err = proc.stderr.read().decode("utf-8", "ignore").strip()
    if rc != 0:
        print(f"Warning: gzip exited with code {rc} ({err}); using {matched:,} matched records recovered before EOF", flush=True)
    print(f"[raw] scanned {total:,} lines, matched {matched:,} French entries in {time.time() - t0:.1f}s", flush=True)
    return out


def load_zhwikt(target_w_lower: set[str], trad_map: dict[str, str]):
    """Load references/lexdb/zhwikt-fr.jsonl.gz keyed by w_lower -> [(p, zh)]."""
    path = resolve_ref("references/lexdb/zhwikt-fr.jsonl.gz")
    out: dict[str, list[tuple[str, str]]] = defaultdict(list)
    if not path.exists():
        return out
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for line in fh:
            d = json.loads(line)
            w = nfc(d.get("word") or "").strip().lower()
            if w not in target_w_lower:
                continue
            raw_pos = d.get("pos", "")
            p = WIKI_POS.get(raw_pos, "")
            tags = set(d.get("tags") or [])
            if p == "n.":
                if "masculine" in tags and "feminine" not in tags:
                    p = "n.m."
                elif "feminine" in tags and "masculine" not in tags:
                    p = "n.f."
            for s in d.get("senses") or []:
                stags = s.get("tags") or []
                if "form-of" in stags or s.get("form_of"):
                    continue
                for g in s.get("glosses") or []:
                    txt = ZHWIKT_TEMPLATE_RE.sub("", nfc(g).strip())
                    txt = to_simp(txt, trad_map)
                    txt = normalize_zh_display(txt, trad_map)
                    if not txt or not has_cjk(txt) or len(txt) > 80:
                        continue
                    # Drop Wiktionary meta notes like "……的阴性单数"
                    if re.search(r"(?:阴性|阳性|复数|变位|变形|拼写|替代写法)(?:形式)?$", txt) and len(txt) < 20:
                        continue
                    pair = (p, txt)
                    if pair not in out[w] and len(out[w]) < 15:
                        out[w].append(pair)
    return out


def load_cfdict(target_w_lower: set[str], trad_map: dict[str, str]):
    """Parse references/lexdb/cfdict.u8 and invert French glosses -> target French lemmas."""
    path = resolve_ref("references/lexdb/cfdict.u8")
    cand: dict[str, list[tuple[int, str]]] = defaultdict(list)
    if not path.exists():
        return {}
    line_re = re.compile(r"^(\S+)\s+(\S+)\s+\[[^\]]*\]\s+/(.+)/\s*$")
    with path.open("r", encoding="utf-8", errors="replace") as fh:
        for ln in fh:
            if not ln or ln.startswith("#"):
                continue
            m = line_re.match(ln.strip())
            if not m:
                continue
            simp = to_simp(nfc(m.group(2)).strip(), trad_map)
            if not simp or not has_cjk(simp) or len(simp) > 12:
                continue
            segs = [s.strip() for s in m.group(3).split("/") if s.strip()]
            for seg in segs:
                if CFDICT_NOISE_RE.search(seg):
                    continue
                seg_l = nfc(seg).lower().strip()
                # Exact match vs trailing parenthetical qualifier: "beau (pour un homme)"
                exact = seg_l in target_w_lower
                base = re.sub(r"\s*\([^)]*\)\s*$", "", seg_l).strip()
                if not exact and base not in target_w_lower:
                    continue
                key = seg_l if exact else base
                # Prefer exact match and 2..4 character modern Chinese terms over single characters
                score = (2 if exact else 0) + (2 if 2 <= len(simp) <= 4 else (1 if len(simp) <= 6 else 0))
                cand[key].append((score, simp))

    out: dict[str, list[str]] = {}
    for w, items in cand.items():
        items.sort(key=lambda x: (-x[0], len(x[1]), x[1]))
        uniq: list[str] = []
        for _, zh in items:
            if zh not in uniq:
                uniq.append(zh)
            if len(uniq) >= 8:
                break
        if uniq:
            out[w] = uniq
    return out


def load_omw(target_w_lower: set[str], trad_map: dict[str, str]):
    """Load references/lexdb/omw-fr-cmn.jsonl keyed by (w_lower, pos)."""
    path = resolve_ref("references/lexdb/omw-fr-cmn.jsonl")
    out: dict[tuple[str, str], list[str]] = defaultdict(list)
    if not path.exists():
        return out
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            d = json.loads(line)
            p = OMW_POS.get(d.get("pos", ""), "")
            if not p:
                continue
            zhs = []
            for z in d.get("zh") or []:
                zz = normalize_zh_display(z.replace("+", ""), trad_map)
                if zz and has_cjk(zz) and len(zz) <= 12 and zz not in zhs:
                    zhs.append(zz)
            if not zhs:
                continue
            for fw in d.get("fr") or []:
                wl = nfc(fw).strip().lower()
                if wl not in target_w_lower:
                    continue
                bucket = out[(wl, p)]
                for zz in zhs[:4]:
                    if zz not in bucket and len(bucket) < 8:
                        bucket.append(zz)
    return out


def load_tatoeba(
    analysis: dict[str, tuple[str, str]],
    target_w_lower: set[str],
    target_folded: set[str],
    trad_map: dict[str, str],
    trad_only: set[str],
):
    """Stream Tatoeba fra/cmn bz2 files and match to target lemmas with UTF-16 hl offsets."""
    tdir = resolve_ref("references/tatoeba")
    fra_p = tdir / "fra_sentences.tsv.bz2"
    cmn_p = tdir / "cmn_sentences.tsv.bz2"
    lnk_p = tdir / "fra-cmn_links.tsv.bz2"
    if not (fra_p.exists() and cmn_p.exists() and lnk_p.exists()):
        print("Warning: Tatoeba bz2 files missing, skipping", flush=True)
        return defaultdict(list), 0

    def read_sents(p: Path):
        res = {}
        with bz2.open(p, "rt", encoding="utf-8") as fh:
            for ln in fh:
                parts = ln.rstrip("\n").split("\t")
                if len(parts) >= 3:
                    res[parts[0]] = parts[2]
        return res

    fra = read_sents(fra_p)
    cmn = read_sents(cmn_p)
    pairs = {}
    dropped_trad = 0
    with bz2.open(lnk_p, "rt", encoding="utf-8") as fh:
        for ln in fh:
            parts = ln.split()
            if len(parts) < 2:
                continue
            a, b = parts[0], parts[1]
            if a not in fra or b not in cmn or a in pairs:
                continue
            zh = normalize_zh_display(to_simp(cmn[b], trad_map), trad_map)
            if any(c in trad_only for c in zh):
                dropped_trad += 1
                continue
            fr = nfc(fra[a]).strip()
            if 12 <= len(fr) <= 100 and len(zh) <= 70:
                pairs[a] = (fr, zh)

    CONTENT = {"NOM", "VER", "AUX", "ADJ", "ADV"}
    ordered = sorted(pairs.values(), key=lambda x: (abs(len(x[0]) - 42), x[0]))
    examples: dict[str, list[tuple[str, str, int, int]]] = defaultdict(list)
    for fr, zh in ordered:
        used: set[str] = set()
        for m in WORD_RE.finditer(fr):
            tok = nfc(m.group()).lower().replace("’", "'").replace("œ", "oe").replace("æ", "ae")
            a = analysis.get(tok)
            if not a or a[1] not in CONTENT:
                continue
            lm = a[0]
            fl = lexdb_fold(lm)
            if (lm not in target_w_lower and fl not in target_folded) or fl in used or len(fl) < 3:
                continue
            if len(examples[fl]) >= 3:
                continue
            used.add(fl)
            s = utf16_offset(fr, m.start())
            e = utf16_offset(fr, m.end())
            examples[fl].append((fr, zh, s, e))
    return examples, dropped_trad


def token_stem(tok: str) -> str:
    return tok[:-1] if len(tok) >= 3 and tok.endswith(("的", "地", "了")) else tok


def tokens_overlap(a_tokens: set[str], b_tokens: set[str]) -> bool:
    if a_tokens & b_tokens:
        return True
    sa = {token_stem(t) for t in a_tokens}
    sb = {token_stem(t) for t in b_tokens}
    if sa & sb:
        return True
    for x in sa:
        if len(x) < 2:
            continue
        for y in sb:
            if len(y) >= 2 and (x in y or y in x):
                return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("--skip-raw", action="store_true", help="Skip streaming raw.jsonl.gz (debug only)")
    args = ap.parse_args()

    t_start = time.time()
    trad_map, trad_only = load_trad_simp()
    fr_zh_wp, fr_zh_fp, lig, wiki_folded = load_fr_zh(trad_map)
    dict_lemmas, lex_all, lex_forms_by_w, analysis, ortho_to_lemmas = load_lexique(lig, wiki_folded)
    atlas = load_atlas_data()

    # Build canonical lemma registry keyed by canonical w.lower()
    # Start from the 38,805 build-dict base lemmas + fr-zh lemmas, then add all visible Atlas entries
    lemmas: dict[str, dict] = {}  # w_lower -> record

    def ensure_lemma(w: str, folded: str, freq: float = 0.0, ipa: str = "", is_phrase: int = 0):
        wl = nfc(w).strip().lower()
        rec = lemmas.get(wl)
        if rec is None:
            rec = {
                "w": nfc(w).strip(),
                "folded": folded,
                "ipa": ipa,
                "freq": freq,
                "atlas_id": None,
                "atlas_order": 999999,
                "level": None,
                "conj": 0,
                "family": None,
                "is_phrase": is_phrase,
                "pos_blocks": {},  # p -> g
                "sources": set(),
            }
            lemmas[wl] = rec
        else:
            if freq > rec["freq"]:
                rec["freq"] = freq
            if not rec["ipa"] and ipa:
                rec["ipa"] = ipa
        return rec

    for (wl, p), item in dict_lemmas.items():
        rec = ensure_lemma(item["w"], item["folded"], item["freq"], item["ipa"], 0)
        rec["sources"].add("lexique")
        g = "m" if p == "n.m." else ("f" if p == "n.f." else None)
        rec["pos_blocks"].setdefault(p, g)

    for (wl, p), items in fr_zh_wp.items():
        it = items[0]
        rec = ensure_lemma(it["w"], lexdb_fold(it["w"]), 0.0, it["ipa"], 1 if " " in it["w"] else 0)
        rec["sources"].add("wikt-zh")
        g = "m" if p == "n.m." else ("f" if p == "n.f." else None)
        rec["pos_blocks"].setdefault(p, g)

    # Map visible Atlas entries
    atlas_by_w: dict[str, list[dict]] = defaultdict(list)
    atlas_id_to_w: dict[str, str] = {}
    for e in atlas["visible"]:
        aid = e["id"]
        w_raw = nfc(e["lemma"]).strip()
        wl = w_raw.lower()
        fl = lexdb_fold(w_raw)
        is_phr = 1 if (" " in w_raw or "/" in w_raw) else 0
        # Frequency from data/frequency.json (mean) -> scale * 2 to match freqlemfilms2 + freqlemlivres
        f_obj = atlas["freq"].get(aid)
        f_score = (f_obj["f"] * 2.0) if f_obj else 0.0
        lex_match = lex_all.get(wl)
        if lex_match:
            f_score = max(f_score, lex_match["freq"])
        ipa_str = (atlas["ipa"].get(aid, {}).get("p") or "").strip() or (lex_match["ipa"] if lex_match else "")
        rec = ensure_lemma(w_raw, fl, f_score, ipa_str, is_phr)
        if rec["atlas_id"] is None:
            rec["atlas_id"] = aid
        rec["atlas_order"] = min(rec["atlas_order"], atlas["idx_order"].get(aid, 999999))
        lvl = atlas["idx_level"].get(aid)
        if lvl and not rec["level"]:
            rec["level"] = lvl
        p_norm, g_norm = norm_atlas_pos(e["pos"])
        rec["pos_blocks"].setdefault(p_norm, g_norm)
        for s in e.get("senses") or []:
            sp, sg = norm_atlas_pos(s.get("pos") or e["pos"])
            rec["pos_blocks"].setdefault(sp, sg)
        rec["sources"].add("atlas")
        if lex_match:
            rec["sources"].add("lexique")
        atlas_by_w[wl].append(e)
        atlas_id_to_w[aid] = wl

    # Assign IDs (folded lemma, plus #2, #3 for accent-distinct homographs ordered by freq desc)
    by_fold: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for wl, rec in lemmas.items():
        by_fold[rec["folded"]].append((wl, rec))
    for fl, group in by_fold.items():
        group.sort(key=lambda x: (x[1]["is_phrase"], -x[1]["freq"], x[1]["atlas_order"], x[0]))
        for idx, (wl, rec) in enumerate(group):
            rec["id"] = fl if idx == 0 else f"{fl}#{idx + 1}"

    # Assign Rank (1 = highest frequency; single words first, then phrases)
    ranked = sorted(
        lemmas.items(),
        key=lambda x: (x[1]["is_phrase"], -x[1]["freq"], x[1]["atlas_order"], x[1]["id"]),
    )
    for r_idx, (_, rec) in enumerate(ranked, 1):
        rec["rank"] = r_idx

    print(f"[base] lemmas={len(lemmas)} (single={sum(1 for r in lemmas.values() if not r['is_phrase'])}, phrases={sum(1 for r in lemmas.values() if r['is_phrase'])}, atlas={sum(1 for r in lemmas.values() if r['atlas_id'])})", flush=True)

    target_w_lower = set(lemmas.keys())
    target_folded = {r["folded"] for r in lemmas.values()}

    # Load other sources
    raw_wikt = stream_wikt_fr(target_w_lower, ortho_to_lemmas) if not args.skip_raw else {
        k: defaultdict(list if k != "pos_tags" else set)
        for k in ("fr_defs", "etym", "forms", "syn", "ant", "derived", "examples", "pos_tags")
    }
    zhwikt = load_zhwikt(target_w_lower, trad_map)
    cfdict = load_cfdict(target_w_lower, trad_map)
    omw = load_omw(target_w_lower, trad_map)
    tatoeba_ex, dropped_trad = load_tatoeba(analysis, target_w_lower, target_folded, trad_map, trad_only)
    print(f"[sources] zhwikt={len(zhwikt)} lemmas, cfdict={len(cfdict)} lemmas, omw={len({w for w, _ in omw})} lemmas, tatoeba={len(tatoeba_ex)} folded lemmas (dropped_trad={dropped_trad})", flush=True)

    # Map families.json & confusables.json & conj.json
    w_to_family: dict[str, str] = {}
    for fam in atlas["families"]:
        fid = fam["id"]
        for aid in fam.get("words") or []:
            wl = atlas_id_to_w.get(aid)
            if wl and wl not in w_to_family:
                w_to_family[wl] = fid

    w_to_confusable: dict[str, list[str]] = defaultdict(list)
    for grp in atlas["confusables"]:
        gid = grp["id"]
        for it in grp.get("items") or []:
            cand = nfc(it.get("lemma") or it.get("w") or "").strip().lower()
            if cand in lemmas and gid not in w_to_confusable[cand]:
                w_to_confusable[cand].append(gid)

    conj_by_w: dict[str, dict] = {}
    for cid, cdata in atlas["conj"].items():
        wl = nfc(cdata.get("i") or "").strip().lower()
        if wl in lemmas:
            conj_by_w[wl] = cdata
        elif cid in atlas_id_to_w:
            conj_by_w[atlas_id_to_w[cid]] = cdata

    # Initialize SQLite
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode = DELETE")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA temp_store = MEMORY")
    init_db(conn)

    # Insert lemmas + child records
    conn.execute("BEGIN")
    stats = defaultdict(int)

    for wl, rec in ranked:
        lid = rec["id"]
        if wl in conj_by_w:
            rec["conj"] = 1
        if wl in w_to_family:
            rec["family"] = w_to_family[wl]

        # Collect all POS blocks for this lemma
        pos_map: dict[str, str | None] = dict(rec["pos_blocks"])
        for p, g in raw_wikt["pos_tags"].get(wl, ()):
            if p == "n." and ("n.m." in pos_map or "n.f." in pos_map):
                continue
            pos_map.setdefault(p, g)
        if not pos_map:
            pos_map["n."] = None

        # Ensure sources tracking
        srcs = set(rec["sources"])
        if wl in raw_wikt["fr_defs"] or wl in raw_wikt["etym"] or wl in raw_wikt["examples"]:
            srcs.add("wikt-fr")
        if wl in zhwikt or any((wl, p) in fr_zh_wp for p in pos_map):
            srcs.add("wikt-zh")
        if wl in cfdict:
            srcs.add("cfdict")
        if any((wl, p) in omw for p in pos_map) or any((wl, op) in omw for op in ("n.", "v.", "adj.", "adv.")):
            srcs.add("omw")
        if rec["folded"] in tatoeba_ex:
            srcs.add("tatoeba")

        conn.execute(
            """
            INSERT INTO lemma(id, w, folded, ipa, level, rank, freq, atlas_id, conj, family, is_phrase, sources_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                lid,
                rec["w"],
                rec["folded"],
                rec["ipa"] or None,
                rec["level"],
                rec["rank"],
                round(rec["freq"], 4),
                rec["atlas_id"],
                rec["conj"],
                rec["family"],
                rec["is_phrase"],
                json.dumps(sorted(srcs), ensure_ascii=False),
            ),
        )

        # Insert pos_blocks ordered by Atlas / Lexique primary POS first
        pb_ids: dict[str, int] = {}
        ordered_pos = sorted(pos_map.items(), key=lambda kv: (0 if kv[0] in rec["pos_blocks"] else 1, kv[0]))
        for order_i, (p, g) in enumerate(ordered_pos):
            cur = conn.execute(
                "INSERT INTO pos_block(lemma_id, p, g, sort_order) VALUES (?, ?, ?, ?)",
                (lid, p, g, order_i),
            )
            pb_ids[p] = cur.lastrowid  # type: ignore[assignment]

        # Build open Chinese gloss pools per POS and overall
        # Each pool maps src -> list[(zh, fr_label, p_hint)]
        open_pools: dict[str, list[tuple[str, str]]] = defaultdict(list)  # src -> [(zh, fr_label)]
        src_tokens_by_pos: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))

        # 1) Atlas senses & glosses
        atlas_senses_by_pos: dict[str, list[dict]] = defaultdict(list)
        for ae in atlas_by_w.get(wl, []):
            for s in ae.get("senses") or []:
                zh = normalize_zh_display(s.get("zh") or "", trad_map)
                if not zh:
                    continue
                sp, _ = norm_atlas_pos(s.get("pos") or ae["pos"])
                atlas_senses_by_pos[sp].append({"zh": zh, "fr": (s.get("fr") or "").strip()})
                open_pools["atlas"].append((zh, (s.get("fr") or "").strip()))
                src_tokens_by_pos[sp]["atlas"].update(zh_tokens(zh, trad_map))
                src_tokens_by_pos["*"]["atlas"].update(zh_tokens(zh, trad_map))

        # 2) wikt-zh: fr-zh.jsonl + zhwikt-fr.jsonl.gz
        wikt_zh_by_pos: dict[str, list[tuple[str, str]]] = defaultdict(list)
        for p in pb_ids:
            for item in fr_zh_wp.get((wl, p), []):
                for zh, lbl, _ in item["tr"]:
                    wikt_zh_by_pos[p].append((zh, lbl))
                    open_pools["wikt-zh"].append((zh, lbl))
                    src_tokens_by_pos[p]["wikt-zh"].update(zh_tokens(zh, trad_map))
                    src_tokens_by_pos["*"]["wikt-zh"].update(zh_tokens(zh, trad_map))
        # Also match n. when pos_block is n.m. / n.f.
        if "n." not in pb_ids:
            target_np = next((p for p in pb_ids if p.startswith("n.")), None)
            if target_np:
                for item in fr_zh_wp.get((wl, "n."), []):
                    for zh, lbl, _ in item["tr"]:
                        wikt_zh_by_pos[target_np].append((zh, lbl))
                        open_pools["wikt-zh"].append((zh, lbl))
                        src_tokens_by_pos[target_np]["wikt-zh"].update(zh_tokens(zh, trad_map))
                        src_tokens_by_pos["*"]["wikt-zh"].update(zh_tokens(zh, trad_map))

        primary_p = ordered_pos[0][0]
        for zp, ztxt in zhwikt.get(wl, []):
            tp = zp if zp in pb_ids else (next((p for p in pb_ids if zp == "n." and p.startswith("n.")), None) or primary_p)
            wikt_zh_by_pos[tp].append((ztxt, ""))
            open_pools["wikt-zh"].append((ztxt, ""))
            src_tokens_by_pos[tp]["wikt-zh"].update(zh_tokens(ztxt, trad_map))
            src_tokens_by_pos["*"]["wikt-zh"].update(zh_tokens(ztxt, trad_map))

        # 3) CFDICT
        for czh in cfdict.get(wl, []):
            open_pools["cfdict"].append((czh, ""))
            src_tokens_by_pos["*"]["cfdict"].update(zh_tokens(czh, trad_map))

        # 4) OMW
        omw_by_pos: dict[str, list[str]] = defaultdict(list)
        for op in ("n.", "v.", "adj.", "adv."):
            zlist = omw.get((wl, op), [])
            if not zlist:
                continue
            tp = op if op in pb_ids else (next((p for p in pb_ids if op == "n." and p.startswith("n.")), None) or primary_p)
            for ozh in zlist:
                omw_by_pos[tp].append(ozh)
                open_pools["omw"].append((ozh, ""))
                src_tokens_by_pos[tp]["omw"].update(zh_tokens(ozh, trad_map))
                src_tokens_by_pos["*"]["omw"].update(zh_tokens(ozh, trad_map))

        # Cross-check & insert senses per pos_block
        first_sense_by_pos: dict[str, int] = {}
        total_senses_with_zh = 0
        for p, pb_id in pb_ids.items():
            s_order = 0
            wikt_fr_defs_p = [d for d in raw_wikt["fr_defs"].get(wl, []) if d[0] == p or (p.startswith("n.") and d[0] == "n.")]

            def calc_conf_and_srcs(zh_str: str, base_srcs: list[str]) -> tuple[int, list[str]]:
                toks = set(zh_tokens(zh_str, trad_map))
                confirmed = list(dict.fromkeys(base_srcs))
                for sname in ("atlas", "wikt-zh", "cfdict", "omw"):
                    if sname in confirmed:
                        continue
                    pool_toks = src_tokens_by_pos[p].get(sname) or src_tokens_by_pos["*"].get(sname) or set()
                    if pool_toks and tokens_overlap(toks, pool_toks):
                        confirmed.append(sname)
                if "atlas" in confirmed:
                    return 3, confirmed
                open_cnt = sum(1 for x in ("wikt-zh", "cfdict", "omw") if x in confirmed)
                if open_cnt >= 3:
                    return 3, confirmed
                if open_cnt == 2:
                    return 2, confirmed
                return 1, confirmed

            # A) Atlas senses for this POS
            for asense in atlas_senses_by_pos.get(p, []):
                zh = asense["zh"]
                fr_lbl = asense["fr"]
                if not fr_lbl and wikt_fr_defs_p:
                    # Do not guess alignment blindly; leave fr empty unless clear
                    pass
                conf, csrcs = calc_conf_and_srcs(zh, ["atlas"])
                cur = conn.execute(
                    "INSERT INTO sense(pos_block_id, lemma_id, fr, reg, zh_merged, src_json, conf, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (pb_id, lid, fr_lbl or None, None, zh, json.dumps(csrcs), conf, s_order),
                )
                sid = cur.lastrowid  # type: ignore[assignment]
                first_sense_by_pos.setdefault(p, sid)
                s_order += 1
                total_senses_with_zh += 1
                conn.execute(
                    "INSERT INTO gloss(sense_id, lemma_id, pos, zh, zh_norm, fr_label, src, conf) VALUES (?, ?, ?, ?, ?, ?, 'atlas', 3)",
                    (sid, lid, p, zh, "；".join(zh_tokens(zh, trad_map)), fr_lbl or None),
                )
                stats["conf_3"] += 1

            # B) Non-atlas open senses (wikt-zh grouped by fr_label, then cfdict/omw if no wikt-zh/atlas)
            existing_toks = set()
            for asense in atlas_senses_by_pos.get(p, []):
                existing_toks.update(zh_tokens(asense["zh"], trad_map))

            grouped_wzh: dict[str, list[str]] = defaultdict(list)
            for zh, lbl in wikt_zh_by_pos.get(p, []):
                grouped_wzh[lbl].append(zh)

            for lbl, zh_list in grouped_wzh.items():
                # Skip if completely redundant with atlas senses on this POS
                dedup_zhs = []
                for z in zh_list:
                    zt = set(zh_tokens(z, trad_map))
                    if existing_toks and zt and zt <= existing_toks:
                        continue
                    if z not in dedup_zhs:
                        dedup_zhs.append(z)
                    existing_toks.update(zt)
                if not dedup_zhs:
                    continue
                merged_zh = "；".join(dedup_zhs[:5])
                # Try matching lbl to wikt-fr definition
                fr_match = lbl or None
                reg_match = None
                if lbl:
                    for _, fg, _, freg in wikt_fr_defs_p:
                        if lbl.lower() in fg.lower():
                            fr_match = fg[:160]
                            reg_match = freg
                            break
                conf, csrcs = calc_conf_and_srcs(merged_zh, ["wikt-zh"])
                if fr_match and "wikt-fr" not in csrcs and wikt_fr_defs_p:
                    csrcs.append("wikt-fr")
                cur = conn.execute(
                    "INSERT INTO sense(pos_block_id, lemma_id, fr, reg, zh_merged, src_json, conf, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (pb_id, lid, fr_match, reg_match, merged_zh, json.dumps(csrcs), conf, s_order),
                )
                sid = cur.lastrowid  # type: ignore[assignment]
                first_sense_by_pos.setdefault(p, sid)
                s_order += 1
                total_senses_with_zh += 1
                conn.execute(
                    "INSERT INTO gloss(sense_id, lemma_id, pos, zh, zh_norm, fr_label, src, conf) VALUES (?, ?, ?, ?, ?, ?, 'wikt-zh', ?)",
                    (sid, lid, p, merged_zh, "；".join(zh_tokens(merged_zh, trad_map)), fr_match, conf),
                )
                stats[f"conf_{conf}"] += 1
                if s_order >= 10:
                    break

            # C) If no senses yet on this POS, fall back to OMW or CFDICT (primary POS gets CFDICT)
            if s_order == 0:
                omw_zhs = omw_by_pos.get(p, [])
                cfd_zhs = cfdict.get(wl, []) if p == primary_p else []
                cand_list = []
                if omw_zhs:
                    cand_list.append(("omw", "；".join(omw_zhs[:5])))
                if cfd_zhs and not omw_zhs:
                    cand_list.append(("cfdict", "；".join(cfd_zhs[:5])))
                elif cfd_zhs and omw_zhs:
                    # Check if cfdict agrees or provides additional short gloss
                    omw_toks = set(zh_tokens("；".join(omw_zhs[:5]), trad_map))
                    cfd_toks = set(zh_tokens("；".join(cfd_zhs[:5]), trad_map))
                    if not tokens_overlap(omw_toks, cfd_toks):
                        cand_list.append(("cfdict", "；".join(cfd_zhs[:5])))
                for src_name, mzh in cand_list:
                    conf, csrcs = calc_conf_and_srcs(mzh, [src_name])
                    cur = conn.execute(
                        "INSERT INTO sense(pos_block_id, lemma_id, fr, reg, zh_merged, src_json, conf, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (pb_id, lid, None, None, mzh, json.dumps(csrcs), conf, s_order),
                    )
                    sid = cur.lastrowid  # type: ignore[assignment]
                    first_sense_by_pos.setdefault(p, sid)
                    s_order += 1
                    total_senses_with_zh += 1
                    conn.execute(
                        "INSERT INTO gloss(sense_id, lemma_id, pos, zh, zh_norm, fr_label, src, conf) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                        (sid, lid, p, mzh, "；".join(zh_tokens(mzh, trad_map)), None, src_name, conf),
                    )
                    stats[f"conf_{conf}"] += 1

            # Record standalone gloss provenance rows from CFDICT & OMW when not already added
            if p == primary_p and wl in cfdict:
                conn.execute(
                    "INSERT INTO gloss(sense_id, lemma_id, pos, zh, zh_norm, fr_label, src, conf) VALUES (?, ?, ?, ?, ?, NULL, 'cfdict', 1)",
                    (first_sense_by_pos.get(p), lid, p, "；".join(cfdict[wl][:6]), "；".join(zh_tokens("；".join(cfdict[wl][:6]), trad_map))),
                )
            if p in omw_by_pos:
                conn.execute(
                    "INSERT INTO gloss(sense_id, lemma_id, pos, zh, zh_norm, fr_label, src, conf) VALUES (?, ?, ?, ?, ?, NULL, 'omw', 1)",
                    (first_sense_by_pos.get(p), lid, p, "；".join(omw_by_pos[p][:6]), "；".join(zh_tokens("；".join(omw_by_pos[p][:6]), trad_map))),
                )

        # Cross-source conflict detection -> review_flag
        has_gloss_conflict = False
        open_src_toks = src_tokens_by_pos["*"]
        non_empty_srcs = [s for s in ("atlas", "wikt-zh", "cfdict", "omw") if open_src_toks.get(s)]
        if len(non_empty_srcs) >= 2:
            has_any_agreement = False
            for i in range(len(non_empty_srcs)):
                for j in range(i + 1, len(non_empty_srcs)):
                    if tokens_overlap(open_src_toks[non_empty_srcs[i]], open_src_toks[non_empty_srcs[j]]):
                        has_any_agreement = True
                        break
                if has_any_agreement:
                    break
            if not has_any_agreement:
                detail = {s: sorted(list(open_src_toks[s]))[:5] for s in non_empty_srcs}
                conn.execute(
                    "INSERT INTO review_flag(lemma_id, kind, detail) VALUES (?, 'gloss_conflict', ?)",
                    (lid, json.dumps(detail, ensure_ascii=False)),
                )
                stats["gloss_conflicts"] += 1
                has_gloss_conflict = True

        # Atlas gender conflict check
        if rec["atlas_id"]:
            ninfo = atlas["nouns"].get(rec["atlas_id"])
            if ninfo and ninfo.get("check") == "conflict":
                conn.execute(
                    "INSERT INTO review_flag(lemma_id, kind, detail) VALUES (?, 'gender_conflict', ?)",
                    (lid, json.dumps(ninfo, ensure_ascii=False)),
                )

        # Examples: Atlas + Wiktionary + Tatoeba
        default_sid = next(iter(first_sense_by_pos.values()), None)
        for ae in atlas_by_w.get(wl, []):
            aid = ae["id"]
            hls = atlas["hl"].get(aid, [])
            ap, _ = norm_atlas_pos(ae["pos"])
            sid = first_sense_by_pos.get(ap, default_sid)
            for idx, ex in enumerate(ae.get("examples") or []):
                fr = nfc(ex.get("fr") or "").strip()
                zh = normalize_zh_display(ex.get("zh") or "", trad_map)
                if not fr or not zh:
                    continue
                span = hls[idx] if idx < len(hls) else None
                if not span:
                    span = find_lexique_hl(fr, {wl}, {rec["folded"]}, ortho_to_lemmas)
                conn.execute(
                    "INSERT INTO example(lemma_id, sense_id, pos, fr, zh, hl_start, hl_end, src) VALUES (?, ?, ?, ?, ?, ?, ?, 'atlas')",
                    (lid, sid, ap, fr, zh, span[0] if span else None, span[1] if span else None),
                )

        for ex_p, ex_fr, h0, h1, ref in raw_wikt["examples"].get(wl, []):
            sid = first_sense_by_pos.get(ex_p, default_sid)
            conn.execute(
                "INSERT INTO example(lemma_id, sense_id, pos, fr, zh, hl_start, hl_end, src, ref) VALUES (?, ?, ?, ?, '', ?, ?, 'wikt-fr', ?)",
                (lid, sid, ex_p, ex_fr, h0, h1, ref),
            )

        for t_fr, t_zh, t_h0, t_h1 in tatoeba_ex.get(rec["folded"], []):
            conn.execute(
                "INSERT INTO example(lemma_id, sense_id, pos, fr, zh, hl_start, hl_end, src) VALUES (?, ?, ?, ?, ?, ?, ?, 'tatoeba')",
                (lid, default_sid, primary_p, t_fr, t_zh, t_h0, t_h1),
            )

        # Phrases: Atlas col + fr-zh multiword matching derived
        seen_phr = set()
        for ae in atlas_by_w.get(wl, []):
            for col in ae.get("col") or []:
                parts = re.split(r"[｜|]", col, maxsplit=1)
                if len(parts) == 2:
                    pfr, pzh = nfc(parts[0]).strip(), normalize_zh_display(parts[1], trad_map)
                    if pfr and pzh and pfr.lower() not in seen_phr:
                        seen_phr.add(pfr.lower())
                        conn.execute(
                            "INSERT INTO phrase(lemma_id, fr, zh, src, conf) VALUES (?, ?, ?, 'atlas', 3)",
                            (lid, pfr, pzh),
                        )

        # Derived phrases that already exist in fr-zh.jsonl
        for dw in raw_wikt["derived"].get(wl, []):
            if " " in dw and dw.lower() not in seen_phr:
                fzh = fr_zh_fp.get((lexdb_fold(dw), "loc."), [])
                if fzh:
                    pzh = "；".join(t[0] for t in fzh[0]["tr"][:3])
                    seen_phr.add(dw.lower())
                    conn.execute(
                        "INSERT INTO phrase(lemma_id, fr, zh, src, conf) VALUES (?, ?, ?, 'wikt-zh', 1)",
                        (lid, dw, pzh),
                    )

        # Relations: syn, ant, derived, family, confusable
        seen_rel = set()
        def add_rel(kind: str, target: str, rsrc: str):
            t = nfc(target).strip()
            if not t or (kind, t.lower()) in seen_rel:
                return
            seen_rel.add((kind, t.lower()))
            conn.execute(
                "INSERT INTO relation(lemma_id, kind, target, src) VALUES (?, ?, ?, ?)",
                (lid, kind, t, rsrc),
            )

        for ae in atlas_by_w.get(wl, []):
            for s in ae.get("syn") or []:
                add_rel("syn", s, "atlas")
            for a in ae.get("ant") or []:
                add_rel("ant", a, "atlas")
            for f in ae.get("fam") or []:
                add_rel("derived", re.sub(r"\s*\([^)]*\)$", "", f).strip(), "atlas")
        for s in raw_wikt["syn"].get(wl, []):
            add_rel("syn", s, "wikt-fr")
        for a in raw_wikt["ant"].get(wl, []):
            add_rel("ant", a, "wikt-fr")
        for d in raw_wikt["derived"].get(wl, []):
            add_rel("derived", d, "wikt-fr")
        if rec["family"]:
            add_rel("family", rec["family"], "atlas")
        for cgid in w_to_confusable.get(wl, []):
            add_rel("confusable", cgid, "atlas")

        # fr_def & etym
        for fp, fg, fex, freg in raw_wikt["fr_defs"].get(wl, []):
            conn.execute(
                "INSERT INTO fr_def(lemma_id, p, gloss, ex, reg, src) VALUES (?, ?, ?, ?, ?, 'wikt-fr')",
                (lid, fp, fg, fex, freg),
            )
        for et in raw_wikt["etym"].get(wl, []):
            conn.execute("INSERT INTO etym(lemma_id, text, src) VALUES (?, ?, 'wikt-fr')", (lid, et))

        # Forms (Lexique + data/forms.json + Wiktionary + conj.json)
        seen_forms: set[tuple[str, str]] = set()
        def add_form(fm: str, tag: str, ffreq: float = 0.0):
            f_clean = nfc(fm).strip()
            if not f_clean or len(f_clean) > 60:
                return
            ff = lexdb_fold(f_clean)
            if (ff, tag) in seen_forms:
                return
            seen_forms.add((ff, tag))
            conn.execute(
                "INSERT INTO form(lemma_id, form, folded_form, tag, freq) VALUES (?, ?, ?, ?, ?)",
                (lid, f_clean, ff, tag, ffreq),
            )

        # Lexique forms for this lemma
        lex_rows = lex_forms_by_w.get(wl, [])
        # Put ligature back when headword uses œ/æ
        def restore_lig(fm: str) -> str:
            if "œ" in rec["w"]:
                return fm.replace("oe", "œ")
            if "æ" in rec["w"]:
                return fm.replace("ae", "æ")
            return fm

        for ortho, cg, genre, nombre, ffreq in lex_rows:
            add_form(restore_lig(ortho), "infl", ffreq)
        # Noun/Adj display forms {f, pl, fpl}
        if any(p.startswith("n.") for p in pb_ids) or "adj." in pb_ids:
            # From data/forms.json if atlas
            if rec["atlas_id"] and rec["atlas_id"] in atlas["forms"]:
                fi = atlas["forms"][rec["atlas_id"]]
                if fi.get("fem"):
                    add_form(fi["fem"], "f", 9999)
                if fi.get("pl"):
                    add_form(fi["pl"], "pl", 9999)
                if fi.get("mpl"):
                    add_form(fi["mpl"], "pl", 9999)
            for fm, ftag in raw_wikt["forms"].get(wl, []):
                add_form(fm, ftag, 500)
            # Infer f/pl/fpl from Lexique if missing
            if "adj." in pb_ids:
                adj_rows = [r for r in lex_rows if r[1] == "ADJ"]
                for r_o, _, r_g, r_n, r_f in sorted(adj_rows, key=lambda x: -x[4]):
                    if r_g == "f" and r_n == "s" and r_o != wl:
                        add_form(restore_lig(r_o), "f", r_f)
                        break
                for r_o, _, r_g, r_n, r_f in sorted(adj_rows, key=lambda x: -x[4]):
                    if r_g in ("m", "") and r_n == "p" and r_o != wl:
                        add_form(restore_lig(r_o), "pl", r_f)
                        break
                for r_o, _, r_g, r_n, r_f in sorted(adj_rows, key=lambda x: -x[4]):
                    if r_g == "f" and r_n == "p" and r_o != wl:
                        add_form(restore_lig(r_o), "fpl", r_f)
                        break
            elif any(p.startswith("n.") for p in pb_ids):
                nom_rows = [r for r in lex_rows if r[1] == "NOM"]
                for r_o, _, r_g, r_n, r_f in sorted(nom_rows, key=lambda x: -x[4]):
                    if r_n == "p" and r_o != wl:
                        add_form(restore_lig(r_o), "pl", r_f)
                        break
        # Atlas pair forms
        for ae in atlas_by_w.get(wl, []):
            af = ae.get("forms")
            if isinstance(af, dict):
                if af.get("f"):
                    add_form(af["f"], "f", 9999)
                if af.get("mPl"):
                    add_form(af["mPl"], "pl", 9999)
                if af.get("fPl"):
                    add_form(af["fPl"], "fpl", 9999)
        # Atlas conj.json forms
        if wl in conj_by_w:
            cdata = conj_by_w[wl]
            if cdata.get("pp"):
                add_form(cdata["pp"], "conj", 500)
            for tense_forms in (cdata.get("f") or {}).values():
                for cf_item in tense_forms:
                    if cf_item:
                        add_form(cf_item, "conj", 500)
            for alt_list in (cdata.get("alt") or {}).values():
                for cf_item in alt_list:
                    if cf_item:
                        add_form(cf_item, "conj", 300)

        # AI job queueing
        tier = "top15k" if (rec["rank"] <= 15000 and not rec["is_phrase"]) else "longtail"
        has_any_zh = total_senses_with_zh > 0
        fr_defs_n = len(raw_wikt["fr_defs"].get(wl, []))
        wikt_ex_n = len(raw_wikt["examples"].get(wl, []))
        needs_list = []
        if tier == "top15k":
            if not has_any_zh or (fr_defs_n > 0 and total_senses_with_zh < min(fr_defs_n, 6)):
                needs_list.append("gloss")
            if wikt_ex_n > 0:
                needs_list.append("ex_zh")
            if len(seen_phr) < 3:
                needs_list.append("phrases")
        else:
            if not has_any_zh:
                needs_list.append("gloss")

        gen_status = "pending" if needs_list else "skipped"
        rev_status = "pending" if (needs_list or has_gloss_conflict) else "skipped"
        conn.execute(
            "INSERT INTO ai_job(lemma_id, tier, needs, gen_status, review_status) VALUES (?, ?, ?, ?, ?)",
            (lid, tier, ",".join(needs_list), gen_status, rev_status),
        )
        stats["total_lemmas"] += 1
        if has_any_zh:
            stats["with_zh"] += 1
        if needs_list:
            stats[f"ai_pending_{tier}"] += 1

    # Write report summary
    now = datetime.now(timezone.utc).isoformat()
    report_items = {
        "generated_at": now,
        "total_lemmas": str(stats["total_lemmas"]),
        "with_zh": str(stats["with_zh"]),
        "conf_3": str(stats["conf_3"]),
        "conf_2": str(stats["conf_2"]),
        "conf_1": str(stats["conf_1"]),
        "gloss_conflicts": str(stats["gloss_conflicts"]),
        "ai_pending_top15k": str(stats["ai_pending_top15k"]),
        "ai_pending_longtail": str(stats["ai_pending_longtail"]),
        "dropped_trad_tatoeba": str(dropped_trad),
    }
    for k, v in report_items.items():
        conn.execute("INSERT INTO report(key, value, updated_at) VALUES (?, ?, ?)", (k, v, now))

    conn.commit()
    conn.close()
    print(f"[done] built {db_path.relative_to(ROOT)} in {time.time() - t_start:.1f}s -> {dict(stats)}", flush=True)


if __name__ == "__main__":
    main()
