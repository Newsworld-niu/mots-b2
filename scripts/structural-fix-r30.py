#!/usr/bin/env python3
"""
r30 structural cleanup.

1. Accent variants confirmed as OCR spelling of the same word -> alias to the
   primary and correct the primary lemma (evidence in data/lessons/r30-structural-evidence.md).
   Genuinely different words (cote/côte, tache/tâche) are left untouched.
2. Chapter-title / article-prefixed entries that duplicate a real headword -> alias
   to that headword. Titles with no single headword are annotated, not deleted.
3. vole / vole-f -> alias of voie (original page 139 prints "voie, la").
4. Same-lemma duplicate placeholders: an entry with no gloss that has exactly one
   glossed same-lemma sibling becomes an alias of that sibling. Entries where both
   sides carry a gloss (genuinely different pos/sense) are kept.

Never deletes an entry; ids, senses and sources are preserved (sources merged into
the primary). Idempotent.
"""
import csv
import json
import os
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/r30-structural-log.csv")

# primary_id, corrected_lemma|None, [alias_id...], reason
EXPLICIT = [
    # --- accent variants (OCR accent loss, same word) ---
    ("carriere", "carrière", ["carriere-f"], "OCR/重音：DELF p45 印 carrière (f)"),
    ("comprime", None, ["comprime-m"], "OCR/重音：DELF p56 原图 comprimé (m)"),
    ("colere", None, ["colere-f"], "OCR/重音：colère 无重音形非词"),
    ("couter", "coûter", ["couter-v"], "OCR/重音：DELF p67 印 coûter"),
    ("elire", None, ["elire-v"], "OCR/重音：DELF p112 印 élire"),
    ("etat", None, ["etat-m"], "大小写/重音： état/État 同词"),
    ("fievre", "fièvre", ["fievre-f"], "OCR/重音：DELF p58 印 fièvre (f)"),
    ("levre", "lèvre", ["levre-f"], "OCR/重音：DELF p59 印 lèvre (f)"),
    ("mise-en-scene", "mise en scène", ["mise-en-scene-f"], "OCR/重音：DELF p93 印 mise en scène (f)"),
    ("piqure", "piqûre", ["piqure-f"], "OCR/重音：DELF p60 印 piqûre (f)"),
    ("probleme", "problème", ["probleme-m"], "OCR/重音：DELF p95 印 problème (m)"),
    ("reglement", "règlement", ["reglement-m"], "OCR/重音：DELF p73/83 印 règlement (m)"),
    ("somnifere", "somnifère", ["somnifere-m"], "OCR/重音：DELF p61 印 somnifère (m)"),
    ("denoncer", "dénoncer", ["denoncer-v"], "OCR/重音：DELF p88/112/122 印 dénoncer"),
    ("epanouissement", "épanouissement", ["epanouissement-m"], "OCR/重音：DELF p125 印 épanouissement；p77 书内误排"),
    # --- chapter titles / article-prefixed duplicates of a real headword ---
    ("education", None, ["l-education"], "章节标题 L'éducation -> éducation (n.f.)"),
    ("sante", None, ["la-sante"], "章节标题 La santé -> santé (n.f.)"),
    ("accomplissement", None, ["un-accomplissement"], "冠词混入 un accomplissement -> accomplissement (n.m.)"),
    ("abonne", None, ["l-abonne"], "冠词混入 l'abonné -> abonné (n.m.)"),
    ("audimat", None, ["l-audimat"], "冠词混入 l'audimat -> audimat (n.m.)"),
    ("entrefilet", None, ["l-entrefilet"], "冠词混入 l'entrefilet -> entrefilet (n.m.)"),
    ("faits-divers", None, ["les-faits-divers"], "冠词混入 les faits divers -> faits divers (n.m.)"),
    ("jeux", None, ["les-jeux"], "冠词混入 les jeux -> jeux (n.m.)"),
    ("cours", None, ["le-cours"], "冠词混入 le cours -> cours (n.m.)"),
    ("animateur", None, ["l-animateur-le-presentateur"], "OCR 合并两词头 l'animateur / le présentateur -> animateur (présentateur 另有词条)"),
    ("les-liens-sociaux-m", None, ["les-liens-sociaux"], "冠词混入 les liens sociaux -> liens sociaux (n.m.)"),
    ("chef-de-clinique-m", None, ["le-chef-de-clinique"], "冠词混入 le chef de clinique -> chef de clinique (n.m.)"),
    # --- p.139 voie ---
    ("voie", None, ["vole", "vole-f"], "原图 p139 印 voie, la；OCR 误作 vole, la"),
]
# entries to annotate only (no word-level primary)
NOTE_ONLY = {
    "les-nouvelles-technologies": "章节标题 Les nouvelles technologies，非单一词条；保留待核实（不删除）。",
    "l-economie-et-la-politique": "章节标题 L'économie et la politique，非单一词条；保留待核实（不删除）。",
    "la-vie-professionnelle-en-france": "导语短语 la vie professionnelle en France，非独立词条；保留待核实。",
}


def has_gloss(e):
    return any(s.get("zh", "").strip() for s in e.get("senses", []))


def src_key(s):
    return (s.get("book"), s.get("kind"), s.get("chapter"), s.get("printedPage"), s.get("pdfPage"))


def merge_into(primary, alias):
    """Move sources and senses of alias into primary (dedup). Return counts."""
    added_src = added_sense = 0
    have = {src_key(s) for s in primary.get("sources", [])}
    for s in alias.get("sources", []):
        if src_key(s) not in have:
            primary.setdefault("sources", []).append(dict(s))
            have.add(src_key(s))
            added_src += 1
    have_zh = {s.get("zh", "").strip() for s in primary.get("senses", []) if s.get("zh", "").strip()}
    for s in alias.get("senses", []):
        zh = s.get("zh", "").strip()
        if zh and zh not in have_zh:
            primary.setdefault("senses", []).append(dict(s))
            have_zh.add(zh)
            added_sense += 1
    for field in ("col", "fam", "syn", "ant"):
        for v in alias.get(field, []):
            if v not in primary.get(field, []):
                primary.setdefault(field, []).append(v)
    if not primary.get("tip") and alias.get("tip"):
        primary["tip"] = alias["tip"]
    return added_src, added_sense


def main():
    with open(LEX, encoding="utf-8") as f:
        lex = json.load(f)
    by_id = {e["id"]: e for e in lex["entries"]}
    log = []

    def do_alias(primary_id, alias_id, reason):
        primary = by_id.get(primary_id)
        alias = by_id.get(alias_id)
        if primary is None:
            log.append({"primary": primary_id, "alias": alias_id, "action": "skipped", "reason": "primary missing"})
            return 0
        if alias is None:
            log.append({"primary": primary_id, "alias": alias_id, "action": "skipped", "reason": "alias missing"})
            return 0
        if primary.get("aliasOf"):
            log.append({"primary": primary_id, "alias": alias_id, "action": "skipped", "reason": "primary is alias"})
            return 0
        if alias.get("aliasOf") == primary_id:
            log.append({"primary": primary_id, "alias": alias_id, "action": "ok-already", "reason": reason})
            return 0
        if alias.get("aliasOf"):
            log.append({"primary": primary_id, "alias": alias_id, "action": "skipped", "reason": "alias points elsewhere"})
            return 0
        a_src, a_sense = merge_into(primary, alias)
        alias["aliasOf"] = primary_id
        log.append({"primary": primary_id, "alias": alias_id, "action": "alias",
                    "reason": f"{reason} (+{a_src} src, +{a_sense} sense)"})
        return 1

    # 1+2+3 explicit
    for primary_id, new_lemma, aliases, reason in EXPLICIT:
        primary = by_id.get(primary_id)
        if primary and new_lemma and primary["lemma"] != new_lemma:
            note = f"r30 拼写修正：{primary['lemma']} → {new_lemma}（依据见 data/lessons/r30-structural-evidence.md）。"
            primary["note"] = ((primary.get("note") or "") + ("；" if (primary.get("note") or "").strip() else "") + note).strip()
            primary["lemma"] = new_lemma
        for aid in aliases:
            do_alias(primary_id, aid, reason)

    # 4 same-lemma duplicate placeholders (empty + exactly one glossed sibling)
    visible = [e for e in lex["entries"] if not e.get("aliasOf")]
    by_lem = {}
    for e in visible:
        by_lem.setdefault(e["lemma"].lower(), []).append(e)
    # never alias a primary that other aliases already point to
    referenced = {e["aliasOf"] for e in lex["entries"] if e.get("aliasOf")}
    # POS protection: an empty placeholder is only auto-merged into its single
    # glossed same-lemma sibling when BOTH carry the SAME specific part of speech.
    # Cross-POS (incl. n.m. vs n.f., adj. vs n.) and unclear POS (待核实) are only
    # recorded as candidates; they are never merged automatically.
    ph = 0
    candidates = []
    for e in visible:
        if e.get("aliasOf") or has_gloss(e) or e["id"] in referenced:
            continue
        sib = [x for x in by_lem.get(e["lemma"].lower(), []) if x is not e and has_gloss(x) and not x.get("aliasOf")]
        if len(sib) != 1:
            continue
        s = sib[0]
        if e["pos"] == s["pos"] and e["pos"] != "待核实":
            ph += do_alias(s["id"], e["id"], "同词形同词性占位条目（无释义）归并")
        else:
            candidates.append({
                "alias": e["id"], "lemma": e["lemma"], "alias_pos": e["pos"],
                "primary": s["id"], "primary_pos": s["pos"],
                "reason": "跨词性/跨阴阳性/词性不明确：仅记录候选，不自动合并" if e["pos"] != "待核实" and s["pos"] != "待核实" else "词性不明确：仅记录候选",
            })

    for eid, note in NOTE_ONLY.items():
        e = by_id.get(eid)
        if e and note not in (e.get("note") or ""):
            e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + note).strip()
            log.append({"primary": eid, "alias": "", "action": "note", "reason": note})

    # sanity: no chained alias, all targets exist
    problems = []
    for e in lex["entries"]:
        if e.get("aliasOf"):
            t = by_id.get(e["aliasOf"])
            if not t:
                problems.append(f'{e["id"]} -> missing {e["aliasOf"]}')
            elif t.get("aliasOf"):
                problems.append(f'{e["id"]} -> chained {e["aliasOf"]}')
    if problems:
        raise SystemExit("alias problems: " + "; ".join(problems[:10]))

    with open(LEX, "w", encoding="utf-8") as f:
        json.dump(lex, f, ensure_ascii=False, indent=2)
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["primary", "alias", "action", "reason"])
        w.writeheader()
        w.writerows(log)
    cand_path = os.path.join(ROOT, "output/r30-placeholder-candidates.csv")
    with open(cand_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["alias", "lemma", "alias_pos", "primary", "primary_pos", "reason"])
        w.writeheader()
        w.writerows(candidates)
    aliased = sum(1 for r in log if r["action"] == "alias")
    print(f"alias operations: {aliased} (explicit + placeholder {ph}); candidates recorded: {len(candidates)}")
    print(f"log: {LOG}")


if __name__ == "__main__":
    main()
