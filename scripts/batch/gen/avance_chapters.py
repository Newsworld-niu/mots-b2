#!/usr/bin/env python3
"""List un-glossed index entries of the avancé book per chapter (printed page ranges).
usage: avance_chapters.py <chapter-no> [--list]"""
import json, sys, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..","..",".."))
STARTS=[6,12,16,22,28,32,40,46,54,62,70,76,84,92,96,102,110,114,118,124,130,134,138,142,148,152,158,166]
END=172
BOOK="Vocabulaire progressif du français (avancé"
def rng(c):
    s=STARTS[c-1]; e=(STARTS[c]-1) if c<len(STARTS) else END
    return s,e
def main():
    c=int(sys.argv[1]); lo,hi=rng(c)
    L=json.load(open(os.path.join(ROOT,"data/lexicon.json"),encoding="utf-8"))["entries"]
    out=[]
    for e in L:
        if e.get("aliasOf") or any(s["zh"] for s in e["senses"]): continue
        srcs=[s for s in e["sources"] if BOOK in s["book"] and s.get("printedPage") and lo<=int(s["printedPage"])<=hi]
        if srcs: out.append(f"{e['lemma']}|{e['pos']}|{e['id']}|p{srcs[0]['printedPage']}")
    print(f"chapter {c} printed {lo}-{hi} unglossed={len(out)}")
    if "--list" in sys.argv: print("\n".join(out))
if __name__=="__main__": main()
