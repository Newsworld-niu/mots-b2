#!/usr/bin/env python3
"""r30 structural fix-up: revert the placeholder merges where the empty entry had a
plausible distinct part of speech from its glossed sibling (could be a different
word/sense). Restores the pre-r30 record and removes the sources that r30 had moved
into the primary. Idempotent."""
import json
import os
import csv

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
BEFORE = os.path.join(ROOT, "data/snapshots/lexicon-before-r30.json")
LOG = os.path.join(ROOT, "output/r30-structural-revert.csv")

# empty entry id whose POS is plausible and differs from its sibling -> keep separate
REVERT = [
    "commode", "imprime", "si", "somme-m", "specialiste", "total", "trouble-m",
    "vague", "majeur-m", "chinois", "juste-adv", "mal-adv", "menteur-adj",
    "mieux-adv", "mecanique", "sourire", "suisse-f", "parisien",
]


def src_key(s):
    return (s.get("book"), s.get("kind"), s.get("chapter"), s.get("printedPage"), s.get("pdfPage"))


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    before = {e["id"]: e for e in json.load(open(BEFORE, encoding="utf-8"))["entries"]}
    by_id = {e["id"]: e for e in lex["entries"]}
    log = []
    for aid in REVERT:
        e = by_id.get(aid)
        b = before.get(aid)
        if not e or not b:
            log.append({"id": aid, "action": "skipped", "reason": "missing"})
            continue
        primary_id = e.get("aliasOf")
        primary = by_id.get(primary_id) if primary_id else None
        # restore alias entry from snapshot
        e["senses"] = b["senses"]
        e["sources"] = b["sources"]
        if "note" in b:
            e["note"] = b["note"]
        elif "note" in e:
            del e["note"]
        e.pop("aliasOf", None)
        # remove sources that r30 moved from this entry into the primary
        removed = 0
        if primary is not None:
            b_src = {src_key(s) for s in b.get("sources", [])}
            p_before = {src_key(s) for s in before.get(primary_id, {}).get("sources", [])}
            keep = []
            for s in primary.get("sources", []):
                # drop only a source that r30 moved from this alias: it is in the
                # alias's pre-r30 sources and was NOT in the primary before r30.
                if src_key(s) in b_src and src_key(s) not in p_before:
                    continue
                keep.append(s)
            removed = len(primary.get("sources", [])) - len(keep)
            primary["sources"] = keep
        log.append({"id": aid, "action": "reverted", "reason": f"distinct pos kept; removed {removed} moved sources"})
    # sanity
    probs = []
    for e in lex["entries"]:
        if e.get("aliasOf"):
            t = by_id.get(e["aliasOf"])
            if not t or t.get("aliasOf"):
                probs.append(e["id"])
    if probs:
        raise SystemExit("alias problems: " + ", ".join(probs[:10]))
    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "action", "reason"])
        w.writeheader()
        w.writerows(log)
    print("reverted:", sum(1 for r in log if r["action"] == "reverted"))


if __name__ == "__main__":
    main()
