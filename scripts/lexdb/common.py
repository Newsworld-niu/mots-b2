#!/usr/bin/env python3
"""Shared normalization, shard-key, POS, and path helpers for LexDB scripts."""
from __future__ import annotations

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
VALID_SOURCES = {"atlas", "wikt-fr", "wikt-zh", "cfdict", "omw", "tatoeba", "lexique", "ai", "ai-reviewed", "user"}

ZH_SPLIT_RE = re.compile(r"[；;，,、/（）()]")
PARENS_RE = re.compile(r"（[^）]*）|\([^)]*\)")
WORD_RE = re.compile(r"[^\W\d_]+(?:-[^\W\d_]+)*", re.UNICODE)

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
    """Shard key matching src/lib/lexdb/types.ts `lexdbKey`."""
    base = lexdb_base_key(folded)
    if not splits or base not in splits:
        return base
    letters = re.sub(r"[^a-z]", "", folded)
    return (letters + "__")[:3]


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


def load_trad_simp() -> tuple[dict[str, str], set[str]]:
    p = resolve_ref("references/wiktionary/trad-simp.json")
    if not p.exists():
        return {}, set()
    trad = json.loads(p.read_text(encoding="utf-8"))
    simp_chars = set(trad.values())
    trad_only = set(trad) - simp_chars
    return trad, trad_only


def to_simp(text: str, trad_map: dict[str, str]) -> str:
    if not trad_map or not text:
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


def has_cjk(text: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)
