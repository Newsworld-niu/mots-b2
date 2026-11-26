#!/usr/bin/env python3
"""Shared normalization, shard-key, POS, and path helpers for LexDB scripts."""
from __future__ import annotations

import ctypes
import ctypes.util
import json
import re
import subprocess
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

# Lexique 3.83 phoneme code -> IPA (matches scripts/build-dict.py & scripts/build-ipa.py)
PHON = {
    "a": "a", "A": "ɑ", "e": "e", "E": "ɛ", "i": "i", "o": "o", "O": "ɔ", "u": "u", "y": "y",
    "2": "ø", "9": "œ", "°": "ə", "@": "ɑ̃", "5": "ɛ̃", "1": "œ̃", "§": "ɔ̃",
    "8": "ɥ", "w": "w", "j": "j",
    "p": "p", "b": "b", "t": "t", "d": "d", "k": "k", "g": "g", "f": "f", "s": "s", "S": "ʃ",
    "v": "v", "z": "z", "Z": "ʒ", "m": "m", "n": "n", "N": "ɲ", "G": "ŋ", "l": "l", "R": "ʁ", "r": "ʁ", "x": "x",
}

LEX_POS = {
    "NOM": "n.",
    "VER": "v.",
    "AUX": "v.",
    "ADJ": "adj.",
    "ADV": "adv.",
    "PRE": "prép.",
    "CON": "conj.",
    "ONO": "interj.",
    "PRO": "pron.",
}

WIKI_POS = {
    "noun": "n.",
    "verb": "v.",
    "adj": "adj.",
    "adv": "adv.",
    "prep": "prép.",
    "prep_phrase": "prép.",
    "conj": "conj.",
    "pron": "pron.",
    "intj": "interj.",
    "phrase": "loc.",
    "proverb": "loc.",
    "idiom": "loc.",
}

OMW_POS = {
    "n": "n.",
    "v": "v.",
    "a": "adj.",
    "s": "adj.",
    "r": "adv.",
}

VALID_POS = {"n.m.", "n.f.", "n.m./f.", "n.", "v.", "adj.", "adv.", "prép.", "conj.", "pron.", "interj.", "loc."}
VALID_LEVELS = {"A1", "A2", "B1", "B2"}
VALID_SOURCES = {"atlas", "wikt-fr", "wikt-zh", "cfdict", "omw", "tatoeba", "lexique", "morphynet", "cnrtl", "frdic", "ai", "ai-reviewed", "user"}

# meta.json["sources"] descriptions shared by export.py and enrich-relations.py
SOURCE_DESCRIPTIONS = {
    "atlas": "Mots B2 Atlas (data/lexicon.json)",
    "lexique": "Lexique 3.83 (CC BY-SA 4.0)",
    "wikt-fr": "Wiktionnaire fr via wiktextract + Wiktionary French entries via Kaikki (CC BY-SA 4.0)",
    "wikt-zh": "Wiktionary zh / fr-zh (CC BY-SA 4.0)",
    "cfdict": "CFDICT (CC BY-SA 3.0)",
    "omw": "WOLF (OMW-fr, CeCILL-C V1) x Chinese Open Wordnet (OMW-cmn)",
    "tatoeba": "Tatoeba fra-cmn (CC BY 2.0 FR)",
    "morphynet": "MorphyNet French derivational morphology v1 (CC BY-SA 4.0)",
    "cnrtl": "CNRTL / ATILF CRISCO DES synonymes & antonymes + morphological families (crawled, rate-limited; relation lists only)",
    "frdic": "Frdic 法语助手 近义词/反义词/派生 (crawled verification batch, rate-limited; relation lists only)",
    "ai": "OpenRouter LLM generation",
    "ai-reviewed": "OpenRouter cross-model review",
}
SOURCE_LICENSES = ["CC BY-SA 4.0", "CC BY 2.0 FR", "CC BY-SA 3.0", "CeCILL-C V1", "WordNet License"]

# public/lexdb/hints/<bucket>.json: Record<lowercase word, [short pos, short zh]>
HINT_ZH_MAX = 18

ZH_SPLIT_RE = re.compile(r"[；;，,、/（）()]")
PARENS_RE = re.compile(r"（[^）]*）|\([^)]*\)")
WORD_RE = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*", re.UNICODE)
LEADING_POS_RE = re.compile(
    r"^(?:\.?\s*(?:n|v|adj|adv|pr[ée]p|conj|pron|interj|loc|art|num|det|dét|aux|part|préf|suff|m|f|pl)"
    r"(?:\s*[./]\s*[a-zA-ZéÉ]+\.?)*\s*\.\s*)+",
    re.IGNORECASE,
)
INLINE_POS_SPLIT_RE = re.compile(
    r"(?<=[\u4e00-\u9fff])\s*(?=(?:n|v|adj|adv|pr[ée]p|conj|pron|interj|loc)(?:\s*[./]\s*[a-zA-ZéÉ]+)*\s*\.)",
    re.IGNORECASE,
)
TRAILING_FORM_NOTE_RE = re.compile(r"\s*(?:f\.?\s*pl|pl|f|m|sing|inv)\.\s*[~a-zA-ZÀ-ÿ'\-/\s]+$", re.IGNORECASE)
LEADING_SENSE_NUM_RE = re.compile(r"^(?:[①-⑳]|\(\d+\)|（\d+）|\d+\s*[.．、)）])\s*")

_COMMON_REPO_ROOT: Path | None = None


def main_repo_root() -> Path:
    global _COMMON_REPO_ROOT
    if _COMMON_REPO_ROOT is not None:
        return _COMMON_REPO_ROOT
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--git-common-dir"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        p = Path(out)
        if not p.is_absolute():
            p = (ROOT / p).resolve()
        if p.name == ".git":
            _COMMON_REPO_ROOT = p.parent
            return _COMMON_REPO_ROOT
    except Exception:
        pass
    _COMMON_REPO_ROOT = ROOT
    return _COMMON_REPO_ROOT


def resolve_ref(rel_path: str | Path) -> Path:
    """Resolve a path in ROOT first, falling back to the main git worktree for gitignored references."""
    p = ROOT / rel_path
    if p.exists():
        return p
    alt = main_repo_root() / rel_path
    if alt.exists():
        return alt
    return p


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def lexdb_fold(s: str) -> str:
    """Fold spelling identically to src/lib/lexdb/types.ts `lexdbFold`."""
    s = re.sub(r"\s+", " ", s.strip().replace("’", "'").replace("‘", "'"))
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("œ", "oe").replace("Œ", "oe").replace("æ", "ae").replace("Æ", "ae")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.category(c).startswith("M"))
    return s.lower()


def lexdb_base_key(folded: str) -> str:
    """Base 2-letter shard key matching src/lib/lexdb/types.ts `lexdbBaseKey`."""
    letters = re.sub(r"[^a-z]", "", folded)
    if not letters or not folded or not folded[0].isalpha():
        return "__"
    return (letters + "_")[:2]


def lexdb_key(folded: str, splits: set[str] | None = None) -> str:
    """Shard key matching src/lib/lexdb/types.ts `lexdbKey` (2 -> 3 -> 4 letter prefix splits)."""
    key = lexdb_base_key(folded)
    if key == "__" or not splits:
        return key
    letters = re.sub(r"[^a-z]", "", folded)
    while len(key) < 4 and key in splits:
        key = (letters + "___")[: len(key) + 1]
    return key


def hint_bucket(word: str) -> str:
    folded = lexdb_fold(word)
    letters = re.sub(r"[^a-z]", "", folded)
    if not letters or not folded or not folded[0].isalpha():
        return "_"
    return letters[0]


def _hint_norm(w: str) -> str:
    return re.sub(r"\s+", " ", nfc(w or "").strip().replace("’", "'").replace("‘", "'")).lower()


def hint_key(word: str) -> str:
    """Key used in public/lexdb/hints/<bucket>.json (exact lowercase NFC spelling, normalized apostrophes/spaces)."""
    return _hint_norm(word)


def _strip_pos_and_num(text: str) -> str:
    cur = text.strip()
    while cur:
        nxt = LEADING_POS_RE.sub("", cur).strip()
        nxt = LEADING_SENSE_NUM_RE.sub("", nxt).strip()
        if nxt == cur:
            break
        cur = nxt
    return cur


def short_hint_zh(zh: str, trad_map: dict[str, str] | None = None, limit: int = HINT_ZH_MAX) -> str:
    """Short simplified-Chinese preview: drop POS prefixes, sense numbers & parentheticals, keep 1-2 terms, cap at `limit`."""
    s = to_simp(nfc(zh or ""), trad_map or {})
    s = PARENS_RE.sub("", s)
    s = re.sub(r"\[[^\]]*\]|【[^】]*】|〈[^〉]*〉", "", s)
    s = INLINE_POS_SPLIT_RE.sub("；", s)
    s = _strip_pos_and_num(s)
    parts: list[str] = []
    for seg in re.split(r"[；;]", s):
        seg = _strip_pos_and_num(seg)
        for p in re.split(r"[，,、/]", seg):
            p = TRAILING_FORM_NOTE_RE.sub("", p)
            p = _strip_pos_and_num(p).strip(" 。.：:·~～!?！？\t")
            if p and has_cjk(p) and p not in parts:
                parts.append(p)
    if not parts:
        return ""
    out = parts[0][:limit]
    for p in parts[1:3]:
        cand = f"{out}；{p}"
        if len(cand) > limit:
            break
        out = cand
    return out


def zh_bucket(term: str) -> int:
    """Bucket (0..63) matching src/lib/lexdb/types.ts `zhBucket`."""
    t = term.strip()
    return ord(t[0]) % 64 if t else 0


def utf16_offset(text: str, idx: int) -> int:
    """Convert Python code-point offset to UTF-16 code-unit offset."""
    return idx + sum(1 for ch in text[:idx] if ord(ch) > 0xFFFF)


def lexique_to_ipa(code: str) -> str | None:
    out = []
    for ch in code:
        if ch in PHON:
            out.append(PHON[ch])
        elif ch not in "0-":
            return None
    return "".join(out)


def parse_num(x: str) -> float:
    try:
        return float(x.replace(",", "."))
    except ValueError:
        return 0.0


_CF = None
_CF_TRANS_ID = None
try:
    _cf_lib = ctypes.util.find_library("CoreFoundation")
    if _cf_lib:
        _cf = ctypes.CDLL(_cf_lib)
        _CF_UTF8 = 0x08000100
        _cf.CFStringCreateWithCString.restype = ctypes.c_void_p
        _cf.CFStringCreateWithCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_uint32]
        _cf.CFStringCreateMutableCopy.restype = ctypes.c_void_p
        _cf.CFStringCreateMutableCopy.argtypes = [ctypes.c_void_p, ctypes.c_long, ctypes.c_void_p]
        _cf.CFStringTransform.restype = ctypes.c_bool
        _cf.CFStringTransform.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_bool]
        _cf.CFStringGetCString.restype = ctypes.c_bool
        _cf.CFStringGetCString.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_long, ctypes.c_uint32]
        _cf.CFRelease.argtypes = [ctypes.c_void_p]
        _CF_TRANS_ID = _cf.CFStringCreateWithCString(None, b"Traditional-Simplified", _CF_UTF8)
        if _CF_TRANS_ID:
            _CF = _cf
except Exception:
    _CF = None
    _CF_TRANS_ID = None

_TO_SIMP_CACHE: dict[str, str] = {}
_SIMP_PRESERVE_RE = re.compile(
    r"瞭望|瞭哨|显著|(?<!谈)论著|专著|巨著|原著|名著|编著|译著|合著|遗著|撰著|新著|卓著|昭著|著称|著述|著名|著作|土著|剃发|苎麻"
)
_POST_T2S_FIXES = (
    ("显着", "显著"),
    ("专着", "专著"),
    ("着称", "著称"),
    ("剃髮", "剃发"),
    ("苧麻", "苎麻"),
)


def load_trad_simp() -> tuple[dict[str, str], set[str]]:
    p = resolve_ref("references/wiktionary/trad-simp.json")
    if not p.exists():
        return {}, set()
    trad = json.loads(p.read_text(encoding="utf-8"))
    simp_chars = set(trad.values())
    trad_only = set(trad) - simp_chars
    return trad, trad_only


def to_simp(text: str, trad_map: dict[str, str] | None = None) -> str:
    if not text or not has_cjk(text):
        return text
    if _CF is not None and _CF_TRANS_ID is not None:
        cached = _TO_SIMP_CACHE.get(text)
        if cached is not None:
            return cached
        saved: list[str] = []

        def _hold(m: re.Match[str]) -> str:
            idx = len(saved)
            saved.append(m.group(0))
            return f"\ue000S{idx}\ue001"

        masked = _SIMP_PRESERVE_RE.sub(_hold, text)
        src = _CF.CFStringCreateWithCString(None, masked.encode("utf-8"), _CF_UTF8)
        out = masked
        if src:
            mut = _CF.CFStringCreateMutableCopy(None, 0, src)
            if mut:
                _CF.CFStringTransform(mut, None, _CF_TRANS_ID, False)
                buf = ctypes.create_string_buffer(len(masked.encode("utf-8")) * 4 + 64)
                if _CF.CFStringGetCString(mut, buf, len(buf), _CF_UTF8):
                    out = buf.value.decode("utf-8")
                _CF.CFRelease(mut)
            _CF.CFRelease(src)
        for idx, tok in enumerate(saved):
            out = out.replace(f"\ue000S{idx}\ue001", tok)
        for bad, good in _POST_T2S_FIXES:
            if bad in out:
                out = out.replace(bad, good)
        if len(_TO_SIMP_CACHE) < 200_000:
            _TO_SIMP_CACHE[text] = out
        return out
    if not trad_map:
        return text
    return "".join(trad_map.get(c, c) for c in text)


def normalize_zh_display(text: str, trad_map: dict[str, str] | None = None) -> str:
    """Normalize Chinese gloss spacing/punctuation while preserving parenthetical context."""
    s = nfc(text).strip()
    if trad_map:
        s = to_simp(s, trad_map)
    s = s.replace(";", "；").replace(" ,", "，").replace(",", "，")
    s = re.sub(r"\s*；\s*", "；", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip("；， ")


def zh_tokens(text: str, trad_map: dict[str, str] | None = None) -> list[str]:
    """Split a Chinese gloss into canonical short terms for cross-checking and zh/ reverse index."""
    s = to_simp(nfc(text), trad_map or {}) if trad_map else nfc(text)
    # Remove parenthetical notes for comparison tokens
    core = PARENS_RE.sub("", s)
    parts = [p.strip(" 。.：:·~～!?！？") for p in ZH_SPLIT_RE.split(core)]
    out: list[str] = []
    for p in parts:
        if 1 <= len(p) <= 20 and p not in out:
            out.append(p)
    return out


def compact_json_bytes(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def load_lexdb_entries(out_dir: Path | None = None) -> dict[str, dict]:
    """Load every shipped public/lexdb/e/*.json entry keyed by entry id (immutable enrichment baseline)."""
    d = (out_dir or ROOT / "public/lexdb") / "e"
    entries: dict[str, dict] = {}
    for fp in sorted(d.glob("*.json")):
        entries.update(json.loads(fp.read_text(encoding="utf-8")))
    return entries


def load_lexdb_forms(out_dir: Path | None = None) -> dict[str, list[str]]:
    d = (out_dir or ROOT / "public/lexdb") / "forms"
    forms: dict[str, list[str]] = {}
    for fp in sorted(d.glob("*.json")):
        forms.update(json.loads(fp.read_text(encoding="utf-8")))
    return forms


def build_hint_shards(entries: dict[str, dict], extra_words=(), atlas_cards=()) -> dict[str, dict[str, list[str]]]:
    """public/lexdb/hints/<bucket>.json payloads: every word in syn/ant/derived (+ extra_words, e.g. Atlas family
    names/examples) -> [short pos, short simplified zh]. LexDB entries (best rank, first sense with zh) win over Atlas cards."""
    words: set[str] = set(w for w in extra_words if w and w.strip())
    for e in entries.values():
        for k in ("syn", "ant", "derived"):
            words.update(e.get(k) or [])
    by_norm: dict[str, list[dict]] = {}
    for e in entries.values():
        by_norm.setdefault(_hint_norm(e["w"]), []).append(e)
    for rows in by_norm.values():
        rows.sort(key=lambda e: (e.get("rank") or 999999, "#" in e["id"], e["id"]))
    atlas: dict[str, list[dict]] = {}
    for c in atlas_cards:
        atlas.setdefault(_hint_norm(c.get("lemma", "")), []).append(c)
    buckets: dict[str, dict[str, list[str]]] = {}
    for w in sorted(words):
        nk = _hint_norm(w)
        pos, zh = "", ""
        for e in by_norm.get(nk, []):
            for pb in e.get("pos") or []:
                z = next((s["zh"] for s in pb.get("senses") or [] if s.get("zh")), "")
                if z:
                    pos, zh = pb.get("p", ""), z
                    break
            if zh:
                break
            if not pos and e.get("pos"):
                pos = e["pos"][0].get("p", "")
        if not zh:
            for c in atlas.get(nk, []):
                z = next((s.get("zh") for s in c.get("senses") or [] if s.get("zh")), "")
                if z:
                    pos, zh = (c.get("pos") or pos), z
                    break
        short_zh = short_hint_zh(zh)
        if pos or short_zh:
            buckets.setdefault(hint_bucket(w), {})[hint_key(w)] = [pos, short_zh]
    return {b: dict(sorted(v.items())) for b, v in buckets.items()}


def write_hint_shards(out_dir: Path, buckets: dict[str, dict[str, list[str]]]) -> None:
    import shutil

    d = out_dir / "hints"
    tmp_d = out_dir / ".hints.tmp"
    old_d = out_dir / ".hints.old"
    shutil.rmtree(tmp_d, ignore_errors=True)
    shutil.rmtree(old_d, ignore_errors=True)
    tmp_d.mkdir(parents=True, exist_ok=True)
    for b in sorted(buckets):
        (tmp_d / f"{b}.json").write_bytes(compact_json_bytes(buckets[b]))
    if d.exists():
        d.rename(old_d)
    tmp_d.rename(d)
    shutil.rmtree(old_d, ignore_errors=True)


def has_cjk(text: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)
