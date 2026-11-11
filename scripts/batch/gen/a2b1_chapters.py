#!/usr/bin/env python3
"""List un-glossed index entries of the A2–B1 book per chapter (printed page ranges).
usage: a2b1_chapters.py <chapter-no> [--list]  → prints count, or lemma|pos|id lines with --list."""
import json, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
STARTS = [8,14,18,26,30,38,44,50,58,64,72,80,86,94,102,110,118,124,132,138,144,152,158,164,170]  # PDF pages
END = 190  # index begins ~190
BOOK = "Vocabulaire progressif du français A2-B1"
def chapter_range(c):
    s = STARTS[c-1]; e = (STARTS[c] - 1) if c < len(STARTS) else END
    return s-2, e-2   # printed pages
def main():
    c = int(sys.argv[1]); lo, hi = chapter_range(c)
    L = json.load(open(os.path.join(ROOT, "data/lexicon.json"), encoding="utf-8"))["entries"]
    out = []
    for e in L:
        if e.get("aliasOf"): continue
        if any(s["zh"] for s in e["senses"]): continue
        srcs = [s for s in e["sources"] if BOOK in s["book"] and s.get("printedPage") and lo <= int(s["printedPage"]) <= hi]
        if srcs: out.append(f"{e['lemma']}|{e['pos']}|{e['id']}|p{srcs[0]['printedPage']}")
    print(f"chapter {c} printed {lo}-{hi} unglossed={len(out)}")
    if "--list" in sys.argv: print("\n".join(out))
if __name__ == "__main__": main()
