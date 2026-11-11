#!/usr/bin/env python3
"""r30 language-quality fixes from the 50-entry sample (evidence: Larousse cache
data/dictionary/r30-larousse.json). Only clear defects are changed; uncertain items
are left and recorded in the report."""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/r30-lang-fix-log.csv")

S = "补充翻译·待核对"
LAROUSSE = "Larousse 法语词典 https://www.larousse.fr/dictionnaires/francais/"


def main():
    with open(LEX, encoding="utf-8") as f:
        lex = json.load(f)
    by_id = {e["id"]: e for e in lex["entries"]}
    log = []

    def set_pos(eid, pos, reason):
        e = by_id.get(eid)
        if not e:
            return
        old = e["pos"]
        if old != pos:
            e["pos"] = pos
            e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + f"r30 词性修正：{old} → {pos}（{reason}）。").strip()
            log.append({"id": eid, "field": "pos", "old": old, "new": pos, "reason": reason})

    def set_gloss(eid, glosses, reason):
        e = by_id.get(eid)
        if not e:
            return
        old = [s.get("zh", "") for s in e.get("senses", [])]
        # keep one book sense then add the corrected supplement senses
        book = [s for s in e.get("senses", []) if not s.get("zh", "").strip()]
        new = (book[:1] if book else [{"zh": "", "fr": "", "origin": "book"}])
        for g in glosses:
            new.append({"zh": g, "fr": "", "origin": "supplement", "status": S})
        e["senses"] = new
        e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + f"r30 释义修正（{reason}）。").strip()
        log.append({"id": eid, "field": "senses", "old": str(old), "new": str(glosses), "reason": reason})

    # 1. diffusion: pos 待核实 -> n.f.
    set_pos("diffusion", "n.f.", LAROUSSE + "diffusion（nom féminin）")

    # 2. cote / côte: glosses were swapped by the accent split.
    set_gloss("cote", ["行情；标价；课税；评价"], LAROUSSE + "cote = cotisation/chiffre, 非海岸")
    set_gloss("cote-f", ["海岸；海滨；肋骨；坡"], LAROUSSE + "côte = littoral/os")

    # 3. tache / tâche: glosses were swapped.
    set_gloss("tache", ["任务；工作；作业"], LAROUSSE + "tâche = travail")
    set_gloss("tache-f", ["斑点；污渍；痕迹"], LAROUSSE + "tache = marque salissante")

    with open(LEX, "w", encoding="utf-8") as f:
        json.dump(lex, f, ensure_ascii=False, indent=2)
    import csv
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "field", "old", "new", "reason"])
        w.writeheader()
        w.writerows(log)
    print("language-quality fixes:", len(log))
    for r in log:
        print(" ", r["id"], r["field"], r["old"], "->", r["new"])


if __name__ == "__main__":
    main()
