#!/usr/bin/env python3
"""
r29 Phase 1 (v4): Clean delf-lists.csv of misrecognized sentence fragments.

Confirmed running-text sentences from the DELF theme introductions are removed
from the import source. Legitimate phrases remain untouched. Two malformed
dictionary notations are reclassified:

  remuer l'opinion publique to demonstrate in favour of =>  -> keep id, clean lemma
  partial ; unbiased : impartial                           -> alias of existing "partial"
  douceur [doux ; douce]                                   -> alias of existing "douceur"

Idempotent: running it again changes nothing.
"""
import csv
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "data/imports/delf-lists.csv")
REMOVED_CSV = os.path.join(ROOT, "data/imports/delf-lists-removed.csv")
LOG_CSV = os.path.join(ROOT, "output/r29-delf-cleanup-log.csv")
LEX_PATH = os.path.join(ROOT, "data/lexicon.json")

CONFIRMED_SENTENCES = {
    "Voici la liste de mots qui est triée par thème. Ce sont les",
    "mots que vous risquez de rencontrer dans les documents pour",
    "cela fait aussi partie de l'apprentissage de chercher le mot et de",
    "personnelle à travers les différentes techniques qui sont",
    "proposées au début de cet ouvrage. Je vous encourage bien sûr",
    "des phrases avec ces mots. Tout en lisant la presse durant votre",
    "vous reconnaissez dans cette liste. Quelques mots sont présents",
    "dans plusieurs catégories",
    "Le vocabulaire de l'éducation et du travail est assez",
    "confondent. Ce vocabulaire est aussi très utile à connaître pour",
    "La santé est un thème qui comprend les maladies",
    "C'est un thème qui comprend le cinéma",
    "C'est un thème qui comprend un nombre important de mots",
    "qui sont utilisés de manière quotidienne. Ils peuvent aussi",
    "apparaître de manière transversale dans des documents relatifs",
    "Ce thème contient des mots relatifs à la famille",
    "C'est un thème qui est de plus en plus présent dans l'actualité",
    "et donc dans les documents qui vous seront proposés pour",
    "l'examen. On pourra vous parler d'environnement à travers le",
    "Il s'agit là également d'un thème récurrent qui prend de",
    "l'importance étant donné le développement ininterrompu de la",
    "technologie. Cette liste inclus aussi le vocabulaire des médias",
    "Le vocabulaire des transports se trouve parfois dans le thème",
    "des loisirs . Il est également en lien avec celui de",
    "l'environnement. Vous entendrez régulièrement parler de",
    "Comme mentionné plus haut",
    "C'est un thème qui est très présent dans l'actualité. L'économie",
    "et la politique vont souvent de pair. L'économie est comme le",
}

CLEAN_LEMMA = {
    "remuer l'opinion publique to demonstrate in favour of =>": "remuer l'opinion publique",
}
AS_ALIAS = {
    "partial ; unbiased : impartial": "partial",
    "douceur [doux ; douce]": "douceur",
}


def main():
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    removed, kept, cleaned, aliased = [], [], [], []
    for r in rows:
        lemma = r["lemma"].strip()
        if lemma in CONFIRMED_SENTENCES:
            removed.append(r)
        elif lemma in CLEAN_LEMMA:
            old = lemma
            r["lemma"] = CLEAN_LEMMA[old]
            r["note"] = (r.get("note", "") + f" 原记录：{old}（r29 清理）").strip()
            cleaned.append((old, r["lemma"]))
            kept.append(r)
        elif lemma in AS_ALIAS:
            aliased.append((lemma, AS_ALIAS[lemma]))
            removed.append(r)  # preserve the original row outside the import source
        else:
            kept.append(r)

    print(f"rows={len(rows)} kept={len(kept)} removed={len(removed)} cleaned={len(cleaned)} aliased={len(aliased)}")

    with open(REMOVED_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(removed)

    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(kept)

    with open(LEX_PATH, encoding="utf-8") as f:
        lex = json.load(f)

    by_lemma = {e["lemma"]: e for e in lex["entries"] if e.get("aliasOf") is None}
    sentence_set = {r["lemma"].strip() for r in removed} - set(AS_ALIAS)
    clean_map = {old: new for old, new in cleaned}
    alias_map = dict(aliased)

    log_rows = []
    for e in lex["entries"]:
        lemma = e["lemma"].strip()
        if lemma in clean_map:
            marker = f"原记录：{lemma}（r29 清理）"
            if marker not in (e.get("note") or ""):
                e["note"] = (e.get("note", "") + " " + marker).strip()
            e["lemma"] = clean_map[lemma]
            log_rows.append({"id": e["id"], "lemma": lemma, "action": "cleaned-lemma", "reason": f"clipped to {clean_map[lemma]}"})
        elif lemma in alias_map:
            primary = by_lemma.get(alias_map[lemma])
            if primary is None:
                log_rows.append({"id": e["id"], "lemma": lemma, "action": "alias-skipped", "reason": f"primary {alias_map[lemma]} not found"})
                continue
            if e.get("aliasOf") != primary["id"]:
                e["aliasOf"] = primary["id"]
                have = {(s.get("book"), s.get("kind"), s.get("printedPage"), s.get("pdfPage")) for s in primary["sources"]}
                for s in e.get("sources", []):
                    key = (s.get("book"), s.get("kind"), s.get("printedPage"), s.get("pdfPage"))
                    if key not in have:
                        primary["sources"].append(s)
            log_rows.append({"id": e["id"], "lemma": lemma, "action": "alias", "reason": f"alias of {primary['id']}"})
        elif lemma in sentence_set:
            marker = "OCR 误识：主题导语段落被当作词条，已从 delf-lists.csv 移除（r29）。"
            if marker not in (e.get("note") or ""):
                sep = "；" if (e.get("note") or "").strip() else ""
                e["note"] = (e.get("note", "") + sep + marker).strip()
            log_rows.append({"id": e["id"], "lemma": lemma, "action": "removed-sentence", "reason": "running text from theme introduction"})

    with open(LEX_PATH, "w", encoding="utf-8") as f:
        json.dump(lex, f, ensure_ascii=False, indent=2)

    with open(LOG_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "lemma", "action", "reason"])
        w.writeheader()
        w.writerows(log_rows)

    print(f"lexicon changes: {len(log_rows)}")
    print(f"removed rows: {REMOVED_CSV}")
    print(f"log: {LOG_CSV}")


if __name__ == "__main__":
    main()
