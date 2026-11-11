#!/usr/bin/env python3
"""Resolve duplicate (lemma, pos) groups created by the r31 gender fill.
For each group of visible entries with the same lemma+pos, keep one primary
(most sources, then glossed, then lowest id) and alias the rest into it,
merging senses and sources. Idempotent."""
import json
import os
import csv
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/r31-dedupe-log.csv")


def has_gloss(e):
    return any(s.get("zh", "").strip() for s in e.get("senses", []))


def src_key(s):
    return (s.get("book"), s.get("kind"), s.get("chapter"), s.get("printedPage"), s.get("pdfPage"))


def merge_into(primary, alias):
    have = {src_key(s) for s in primary.get("sources", [])}
    for s in alias.get("sources", []):
        if src_key(s) not in have:
            primary.setdefault("sources", []).append(dict(s)); have.add(src_key(s))
    have_zh = {s.get("zh", "").strip() for s in primary.get("senses", []) if s.get("zh", "").strip()}
    for s in alias.get("senses", []):
        zh = s.get("zh", "").strip()
        if zh and zh not in have_zh:
            primary.setdefault("senses", []).append(dict(s)); have_zh.add(zh)
    have_ex = {x.get("fr") for x in primary.get("examples", [])}
    for x in alias.get("examples", []):
        if x.get("fr") and x.get("fr") not in have_ex:
            primary.setdefault("examples", []).append(dict(x)); have_ex.add(x.get("fr"))
    for field in ("col", "fam", "syn", "ant"):
        for v in alias.get(field, []):
            if v not in primary.get(field, []):
                primary.setdefault(field, []).append(v)
    if not primary.get("tip") and alias.get("tip"):
        primary["tip"] = alias["tip"]
    an = alias.get("note") or ""; pn = primary.get("note") or ""
    if an and an not in pn:
        primary["note"] = (pn + ("；" if pn.strip() else "") + an).strip()


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    visible = [e for e in lex["entries"] if not e.get("aliasOf")]
    groups = defaultdict(list)
    for e in visible:
        # match checkLexicon's entryKey: lemma is case-insensitive
        groups[(e["lemma"].strip().lower(), e["pos"])].append(e)
    dups = {k: v for k, v in groups.items() if len(v) > 1}
    log = []
    for (lemma, pos), items in dups.items():
        items.sort(key=lambda e: (-len(e.get("sources", [])), -int(has_gloss(e)), e["id"]))
        primary = items[0]
        for alias in items[1:]:
            merge_into(primary, alias)
            alias["aliasOf"] = primary["id"]
            log.append({"lemma": lemma, "pos": pos, "primary": primary["id"], "alias": alias["id"]})
    # validate
    probs = []
    ids = set()
    keys = set()
    for e in lex["entries"]:
        if e["id"] in ids:
            probs.append("dup id " + e["id"])
        ids.add(e["id"])
        if e.get("aliasOf"):
            continue
        k = (e["lemma"].strip().lower(), e["pos"])
        if k in keys:
            probs.append("dup key " + str(k))
        keys.add(k)
    if probs:
        raise SystemExit("still duplicates: " + "; ".join(probs[:10]))
    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    # append so a later re-run does not erase the earlier record
    new_file = not os.path.exists(LOG)
    with open(LOG, "a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["lemma", "pos", "primary", "alias"])
        if new_file:
            w.writeheader()
        w.writerows(log)
    print("duplicate groups:", len(dups), "aliased:", len(log))


if __name__ == "__main__":
    main()
