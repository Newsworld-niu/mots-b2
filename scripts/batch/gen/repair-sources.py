#!/usr/bin/env python3
"""Targeted repair (r19): A2-B1 / avancé / DELF batches recorded the Débutant book because build.py
inherited 'book' (and level_basis) from the Débutant template row. The batch chapter label is reliable
and is embedded in each misattributed source (…（A2-B1 第 N 课）/（高级 第 N 课）/（DELF B2）).
Rewrite ONLY those source rows' book field, and fix level_basis on entries that still carry the
hard-coded Débutant A1 basis. IDs, learning records and other sources untouched.
Log -> output/repair-sources.log"""
import json, os
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),"..","..",".."))
DEB="法语词汇渐进初级 Vocabulaire Progressif Du Français Debutant (Claire Miquel).pdf"
A2B1="Vocabulaire progressif du français A2-B1 (Anne Goliot-Lété Claire Miquel).pdf"
AVA="Vocabulaire progressif du français (avancé B2 C1.1) (Claire Miquel).pdf"
DELF="Vocabulaire DELF B2 3000 mots.pdf"
LB={"a2b1":"教材定位（推定，逐词未核实）：B1；依据 封面「A2 B1 INTERMÉDIAIRE」；前言「niveau B1」（PDF 第 5 页）",
    "avance":"未核实：书籍为 B2/C1 教材，封面等级不套用到逐词",
    "delf":"未核实：书籍为 B2 教材，逐词等级未确认"}
lex=json.load(open(os.path.join(ROOT,"data/lexicon.json"),encoding="utf-8"))
changed={"a2b1":0,"avance":0,"delf":0}; touched={}; log=[]
for e in lex["entries"]:
    for s in e["sources"]:
        if s.get("book")!=DEB: continue
        ch=s.get("chapter") or ""
        if "A2-B1" in ch: w,bk="a2b1",A2B1
        elif "高级 第" in ch: w,bk="avance",AVA
        elif "DELF" in ch: w,bk="delf",DELF
        else: continue
        s["book"]=bk; changed[w]+=1; touched.setdefault(e["id"],w)
lbfix=0
for e in lex["entries"]:
    if e["id"] in touched and "A1 DÉBUTANT" in (e.get("levelBasis") or ""):
        e["levelBasis"]=LB[touched[e["id"]]]; lbfix+=1
json.dump(lex,open(os.path.join(ROOT,"data/lexicon.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=2)
open(os.path.join(ROOT,"data/lexicon.json"),"a",encoding="utf-8").write("\n")
open(os.path.join(ROOT,"output/repair-sources.log"),"w",encoding="utf-8").write(
  f"rewritten book fields={sum(changed.values())} by book={changed} level_basis_fixed={lbfix}\n")
print("rewritten",sum(changed.values()),changed,"level_basis_fixed",lbfix)
