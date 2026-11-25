"""Build explicit French derivation groups for public/atlas/families.json — never spelling heuristics.

Existing groups (ids, order, curated members) are preserved; multi-word examples are dropped. New groups come
from the enriched LexDB `derived` lists (scripts/lexdb/enrich-relations.py: Wiktionary/MorphyNet, CNRTL/ATILF
families, Frdic 派生, curated Atlas fam), keeping only words that are exact LexDB/Atlas headwords. A new group is
created for a card only when it links at least one other visible Atlas card and is not already covered by an
existing group.

Usage: python3 scripts/build-families.py   (reads public/lexdb/e/*.json + data/lexicon.json)
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

root = Path(__file__).resolve().parent.parent
FAMILIES = root / "public/atlas/families.json"
SOURCE_NEW = "LexDB · dérivés (Wiktionary · MorphyNet · CNRTL)"
MAX_EXAMPLES = 10


def key(s: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", s or "").strip().replace("’", "'")).lower()


def load_lexdb_entries() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for fp in sorted((root / "public/lexdb/e").glob("*.json")):
        out.update(json.loads(fp.read_text(encoding="utf-8")))
    return out


def build(
    lexdb_entries: dict[str, dict] | None = None,
    existing: list[dict] | None = None,
    strong_derived: dict[str, list[str]] | None = None,
) -> list[dict]:
    """`existing` = groups to preserve (enrich-relations.py passes the pre-enrichment families.json from git so
    reruns are idempotent); `strong_derived` optionally supplies filtered high-confidence derived lists per entry id."""
    entries = lexdb_entries if lexdb_entries is not None else load_lexdb_entries()
    lex = json.loads((root / "data/lexicon.json").read_text(encoding="utf-8"))
    cards = [e for e in lex["entries"] if not e.get("aliasOf")]
    card_ids = {c["id"] for c in cards}
    by_lemma: dict[str, list[str]] = {}
    for c in cards:
        by_lemma.setdefault(key(c["lemma"]), []).append(c["id"])
    card_zh = {c["id"]: next((s.get("zh") for s in c.get("senses") or [] if s.get("zh")), "") for c in cards}
    lemma_of = {c["id"]: c["lemma"] for c in cards}

    # 1) preserve existing groups (ids + order), drop multi-word examples and unknown card ids
    if existing is None:
        existing = json.loads(FAMILIES.read_text(encoding="utf-8")) if FAMILIES.exists() else []
    out: list[dict] = []
    for g in existing:
        g = dict(g)
        g["words"] = [w for w in dict.fromkeys(g.get("words") or []) if w in card_ids]
        g["examples"] = [x for x in dict.fromkeys(g.get("examples") or []) if x and " " not in x.strip()]
        if g["words"]:
            out.append(g)
    by_id = {g["id"]: g for g in out}
    member_sets = [set(g["words"]) for g in out]

    def derived_for(e: dict) -> list[str]:
        raw = strong_derived.get(e["id"], []) if strong_derived is not None else (e.get("derived") or [])
        return [d for d in raw if " " not in d][:MAX_EXAMPLES]

    # 2) new groups from the enriched LexDB derived lists, most frequent cards first
    linked = sorted(
        (e for e in entries.values() if e.get("atlasId") in card_ids and derived_for(e)),
        key=lambda e: (e.get("rank") or 999999, e["id"]),
    )
    added = 0
    for e in linked:
        cid = e["atlasId"]
        derived = derived_for(e)
        members = [cid] + [i for d in derived for i in by_lemma.get(key(d), []) if i != cid]
        members = list(dict.fromkeys(members))
        if len(members) < 2:
            continue
        mset = set(members)
        if any(mset <= s for s in member_sets):
            continue  # already covered by an existing family
        if cid in by_id:
            g = by_id[cid]
            g["words"] = list(dict.fromkeys(g["words"] + members))
            g["examples"] = list(dict.fromkeys(g["examples"] + derived))
            member_sets.append(set(g["words"]))
            continue
        g = {
            "id": cid,
            "name": lemma_of[cid],
            "zh": card_zh.get(cid, ""),
            "words": members,
            "examples": derived,
            "source": SOURCE_NEW,
        }
        out.append(g)
        by_id[cid] = g
        member_sets.append(mset)
        added += 1

    FAMILIES.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    covered = len({i for g in out for i in g["words"]})
    print(f"[families] {len(out)} groups ({len(existing)} kept/cleaned, {added} new); {covered} cards covered", flush=True)
    return out


if __name__ == "__main__":
    build()
    sys.exit(0)
