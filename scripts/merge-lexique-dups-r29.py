#!/usr/bin/env python3
"""
r29 Phase 2: Merge duplicate empty Lexique entries into their primary entry.

Only groups where the word form is the same and the part of speech / source
evidence supports one headword are merged. Entries are never deleted: the
duplicate becomes an alias (aliasOf) so its old ID keeps resolving and its
sources are merged into the primary. Disputed groups (vole / vole-f) are left
untouched.

Idempotent: running it again changes nothing.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX_PATH = os.path.join(ROOT, "data/lexicon.json")
LOG_CSV = os.path.join(ROOT, "output/r29-lexique-alias-log.csv")

# primary id <- [alias ids]
MERGES = {
    "adolescent-m": ["adolescent", "adolescent-n"],
    "attentif-adj": ["attentif", "attentif-loc"],
    "chomeur": ["chomeur-", "chomeur-loc"],
    "doue": ["doue-", "doue-loc"],
    "experimente-adj": ["experimente", "experimente-loc"],
    "fiance-m": ["fiance", "fiance-loc"],
    "greve": ["greve-", "greve-f"],
    "hair-v": ["hair"],
    "immigre-m": ["immigre", "immigre-"],
    "laicite-f": ["laicite"],
    "lyceen": ["lyceen-loc", "lyceen-", "lyceen-n"],
    "matrimonial-adj": ["matrimonial", "matrimonial-loc"],
    "performant": ["performant-", "performant-loc"],
    "planete": ["planete-", "planete-f"],
    "polluant-adj": ["polluant", "polluant-", "polluant-loc"],
    "propriete-f": ["propriete", "propriete-"],
    "rupture-f": ["rupture", "rupture-v"],
    "scene": ["scene-", "scene-f"],
    "stagiaire-n": ["stagiaire", "stagiaire-loc", "stagiaire-m"],
    "surdoue-adj": ["surdoue", "surdoue-loc"],
    "tour": ["tour-loc", "tour-"],
    "trimestriel-adj": ["trimestriel", "trimestriel-loc"],
    "valise-f": ["valise", "valise-"],
    "visite-f": ["visite", "visite-"],
    # vole / vole-f intentionally NOT merged: word form is disputed (possibly voile)
}


def main():
    with open(LEX_PATH, encoding="utf-8") as f:
        lex = json.load(f)

    by_id = {e["id"]: e for e in lex["entries"]}
    log_rows = []
    merged = 0
    for primary_id, alias_ids in MERGES.items():
        primary = by_id.get(primary_id)
        if primary is None:
            log_rows.append({"primary": primary_id, "alias": "", "action": "skipped", "reason": "primary not found"})
            continue
        if primary.get("aliasOf"):
            log_rows.append({"primary": primary_id, "alias": "", "action": "skipped", "reason": "primary is itself an alias"})
            continue
        for alias_id in alias_ids:
            alias = by_id.get(alias_id)
            if alias is None:
                log_rows.append({"primary": primary_id, "alias": alias_id, "action": "skipped", "reason": "alias not found"})
                continue
            if alias.get("aliasOf") == primary_id:
                log_rows.append({"primary": primary_id, "alias": alias_id, "action": "already-aliased", "reason": ""})
                continue
            if alias.get("aliasOf"):
                log_rows.append({"primary": primary_id, "alias": alias_id, "action": "skipped", "reason": "already aliased elsewhere"})
                continue
            # merge sources (chapter is part of the key: same page, different theme)
            have = {(s.get("book"), s.get("kind"), s.get("chapter"), s.get("printedPage"), s.get("pdfPage")) for s in primary.get("sources", [])}
            added = 0
            for s in alias.get("sources", []):
                key = (s.get("book"), s.get("kind"), s.get("chapter"), s.get("printedPage"), s.get("pdfPage"))
                if key not in have:
                    primary.setdefault("sources", []).append(s)
                    have.add(key)
                    added += 1
            alias["aliasOf"] = primary_id
            merged += 1
            log_rows.append({"primary": primary_id, "alias": alias_id, "action": "aliased", "reason": f"sources merged +{added}"})

    # sanity: no chained aliases, every target exists
    problems = []
    for e in lex["entries"]:
        if e.get("aliasOf"):
            t = by_id.get(e["aliasOf"])
            if not t:
                problems.append(f'{e["id"]} -> missing {e["aliasOf"]}')
            elif t.get("aliasOf"):
                problems.append(f'{e["id"]} -> chained alias {e["aliasOf"]}')
    if problems:
        raise SystemExit("alias problems: " + "; ".join(problems[:10]))

    with open(LEX_PATH, "w", encoding="utf-8") as f:
        json.dump(lex, f, ensure_ascii=False, indent=2)

    with open(LOG_CSV, "w", encoding="utf-8", newline="") as f:
        import csv as _csv
        w = _csv.DictWriter(f, fieldnames=["primary", "alias", "action", "reason"])
        w.writeheader()
        w.writerows(log_rows)

    print(f"merged (new aliases): {merged}")
    print(f"log: {LOG_CSV}")


if __name__ == "__main__":
    main()
