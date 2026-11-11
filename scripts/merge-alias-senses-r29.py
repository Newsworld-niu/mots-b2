#!/usr/bin/env python3
"""Merge senses from aliased entries into their primary so no gloss is hidden.
Idempotent: existing (folded) glosses are not duplicated."""
import json
import os
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX_PATH = os.path.join(ROOT, "data/lexicon.json")


def fold(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


with open(LEX_PATH, encoding="utf-8") as f:
    lex = json.load(f)

by_id = {e["id"]: e for e in lex["entries"]}
added = 0
for e in lex["entries"]:
    if not e.get("aliasOf"):
        continue
    primary = by_id.get(e["aliasOf"])
    if primary is None:
        continue
    have = {fold(s.get("zh", "")) for s in primary.get("senses", []) if s.get("zh", "").strip()}
    for s in e.get("senses", []):
        zh = s.get("zh", "").strip()
        if not zh:
            continue
        if fold(zh) in have:
            continue
        primary.setdefault("senses", []).append(dict(s))
        have.add(fold(zh))
        added += 1

with open(LEX_PATH, "w", encoding="utf-8") as f:
    json.dump(lex, f, ensure_ascii=False, indent=2)
print("senses merged into primaries:", added)
