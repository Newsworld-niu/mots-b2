#!/usr/bin/env python3
"""Regression check for the r30 placeholder-merge rule.

The rule in scripts/structural-fix-r30.py must NOT auto-merge an empty placeholder
across parts of speech. This script re-derives the rule's decision for the 18 cases
that were wrongly merged and reverted, and fails if any of them would be merged or
if any has an aliasOf set.

Usage: python3 scripts/check-structural-rule-r30.py   (exit 0 = OK)
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")

REVERTED = [
    "commode", "imprime", "si", "somme-m", "specialiste", "total", "trouble-m",
    "vague", "majeur-m", "chinois", "juste-adv", "mal-adv", "menteur-adj",
    "mieux-adv", "mecanique", "sourire", "suisse-f", "parisien",
]


def has_gloss(e):
    return any(s.get("zh", "").strip() for s in e.get("senses", []))


def main():
    entries = json.load(open(LEX, encoding="utf-8"))["entries"]
    by_id = {e["id"]: e for e in entries}
    visible = [e for e in entries if not e.get("aliasOf")]
    by_lem = {}
    for e in visible:
        by_lem.setdefault(e["lemma"].lower(), []).append(e)

    problems = []
    for eid in REVERTED:
        e = by_id.get(eid)
        if e is None:
            problems.append(f"{eid}: missing")
            continue
        if e.get("aliasOf"):
            problems.append(f"{eid}: has aliasOf={e['aliasOf']} (should stay separate)")
            continue
        sib = [x for x in by_lem.get(e["lemma"].lower(), []) if x is not e and has_gloss(x) and not x.get("aliasOf")]
        if len(sib) != 1:
            # not a single glossed sibling -> rule would not merge anyway
            continue
        s = sib[0]
        mergeable = e["pos"] == s["pos"] and e["pos"] != "待核实"
        if mergeable:
            problems.append(f"{eid}: rule would merge into {s['id']} (same pos {e['pos']})")

    if problems:
        print("REGRESSION FAILED:")
        for p in problems:
            print("  ", p)
        sys.exit(1)
    print(f"OK: {len(REVERTED)} reverted cross-POS entries stay separate; rule does not re-merge them")


if __name__ == "__main__":
    main()
