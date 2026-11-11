#!/usr/bin/env python3
"""Keep the French words of French Wiktionary that have Chinese (Mandarin) translations.

Input:  the wiktextract dump of fr.wiktionary on stdin (kaikki.org/frwiktionary, raw-wiktextract-data.jsonl.gz,
        CC BY-SA), already decompressed. It is streamed: the 6 GB file is never stored.
Output: references/wiktionary/fr-zh.jsonl, one line per French word and part of speech:
        {"w", "pos", "g": "m"|"f"|"mf"|"", "ipa", "tr": [[chinese, french sense label, sense index], ...]}
        references/wiktionary/trad-simp.json: traditional → simplified characters, learned from the translations that
        give both writings (used to convert Tatoeba's Chinese sentences, which mix the two).
Usage:  curl -sSL https://kaikki.org/frwiktionary/raw-wiktextract-data.jsonl.gz | gunzip | python3 -I scripts/filter-wiktionary.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "references/wiktionary/fr-zh.jsonl"
OUT.parent.mkdir(parents=True, exist_ok=True)

kept = seen = 0
trad = {}  # traditional char -> {simplified char: count}
with open(OUT, "w", encoding="utf-8") as out:
    for line in sys.stdin:
        if '"lang_code": "fr"' not in line or ('"lang_code": "zh"' not in line and '"lang_code": "cmn"' not in line):
            continue
        try:
            d = json.loads(line)
        except ValueError:
            continue
        if d.get("lang_code") != "fr":
            continue
        seen += 1
        tr = []
        for t in d.get("translations") or []:
            if t.get("lang_code") not in ("zh", "cmn") or not t.get("word"):
                continue
            tw = (t.get("traditional_writing") or "").strip()
            if tw and len(tw) == len(t["word"].strip()):
                for a, b in zip(tw, t["word"].strip()):
                    if a != b:
                        trad.setdefault(a, {}).setdefault(b, 0)
                        trad[a][b] += 1
            item = [t["word"].strip(), (t.get("sense") or "").strip()[:80], t.get("sense_index") or 0]
            if item[0] and item not in tr:
                tr.append(item)
        if not tr:
            continue
        tags = set(d.get("tags") or [])
        g = "mf" if {"masculine", "feminine"} <= tags else "m" if "masculine" in tags else "f" if "feminine" in tags else ""
        ipa = next((s["ipa"].strip("\\[] ") for s in d.get("sounds") or [] if s.get("ipa", "").startswith("\\")), "")
        out.write(json.dumps({"w": d.get("word", ""), "pos": d.get("pos", ""), "g": g, "ipa": ipa, "tr": tr[:12]}, ensure_ascii=False) + "\n")
        kept += 1
pairs = {a: max(bs, key=bs.get) for a, bs in trad.items()}
json.dump(pairs, open(OUT.parent / "trad-simp.json", "w", encoding="utf-8"), ensure_ascii=False)
print({"trad_chars": len(pairs), "french_with_zh_line": seen, "kept": kept, "out": str(OUT)})
