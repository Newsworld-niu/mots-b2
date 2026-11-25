#!/usr/bin/env python3
"""Validate exported public/lexdb/ shards against docs/dictionary/ENTRY_SCHEMA.md and report coverage/size stats.

Usage:
  python3 scripts/lexdb/check.py [--out public/lexdb] [--db data/lexdb/lexdb.sqlite]
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (
    HINT_ZH_MAX,
    ROOT,
    VALID_LEVELS,
    VALID_POS,
    VALID_SOURCES,
    compact_json_bytes,
    hint_bucket,
    hint_key,
    lexdb_fold,
    lexdb_key,
    zh_bucket,
)

DEFAULT_OUT = ROOT / "public/lexdb"
DEFAULT_DB = ROOT / "data/lexdb/lexdb.sqlite"
MAX_SHARD_BYTES = 409_600  # 400 KB
MAX_TOTAL_BYTES = 80 * 1024 * 1024  # 80 MiB hard cap across every file under public/lexdb/
RELATION_KINDS = ("derived", "syn", "ant")
REQUIRED_PILOT_WORDS = [
    "prendre",
    "faire",
    "mettre",
    "tenir",
    "passer",
    "beau",
    "accueil",
    "temps",
    "coup",
    "fois",
]


def norm_rel(w: str) -> str:
    return " ".join(w.replace("’", "'").replace("‘", "'").split()).lower()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--db", default=str(DEFAULT_DB))
    args = ap.parse_args()

    out_dir = Path(args.out)
    db_path = Path(args.db)
    errors: list[str] = []
    warnings: list[str] = []

    meta_p = out_dir / "meta.json"
    if not meta_p.exists():
        print(f"FAIL: missing {meta_p}")
        sys.exit(1)
    meta = json.loads(meta_p.read_text(encoding="utf-8"))
    for req_key in ("version", "generated", "sources", "licenses", "splits", "counts"):
        if req_key not in meta:
            errors.append(f"meta.json missing key: {req_key}")
    splits = set(meta.get("splits") or [])

    total_bytes = meta_p.stat().st_size
    max_shard_bytes = 0
    max_shard_name = ""

    # 1) Validate e/<key>.json shards
    e_dir = out_dir / "e"
    e_files = sorted(e_dir.glob("*.json"))
    if not e_files:
        errors.append("No entry shards found under public/lexdb/e/")

    all_entries: dict[str, dict] = {}
    conf_dist = {0: 0, 1: 0, 2: 0, 3: 0}
    with_zh = 0
    top15k_total = 0
    top15k_all_sections = 0

    for fp in e_files:
        sz = fp.stat().st_size
        total_bytes += sz
        if sz > max_shard_bytes:
            max_shard_bytes = sz
            max_shard_name = f"e/{fp.name}"
        if sz > MAX_SHARD_BYTES:
            errors.append(f"e/{fp.name} exceeds 400 KB limit ({sz} bytes)")

        shard_key = fp.stem
        data = json.loads(fp.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            errors.append(f"e/{fp.name} is not a JSON object")
            continue

        for eid, entry in data.items():
            if not isinstance(entry, dict):
                errors.append(f"e/{fp.name}:{eid} not an object")
                continue
            if entry.get("id") != eid:
                errors.append(f"e/{fp.name}:{eid} mismatched entry.id={entry.get('id')}")
            exp_key = lexdb_key(lexdb_fold(eid), splits)
            if exp_key != shard_key:
                errors.append(f"e/{fp.name}:{eid} placed in wrong shard (expected {exp_key})")
            if not entry.get("w") or not isinstance(entry.get("pos"), list) or not entry["pos"]:
                errors.append(f"e/{fp.name}:{eid} missing w or non-empty pos")
            if "level" in entry and entry["level"] not in VALID_LEVELS:
                errors.append(f"e/{fp.name}:{eid} invalid level {entry['level']}")
            srcs = entry.get("sources")
            if not isinstance(srcs, list) or not srcs or any(s not in VALID_SOURCES for s in srcs):
                errors.append(f"e/{fp.name}:{eid} invalid sources {srcs}")

            entry_has_zh = False
            entry_has_ex = False
            for pb in entry.get("pos") or []:
                if pb.get("p") not in VALID_POS:
                    errors.append(f"e/{fp.name}:{eid} invalid pos {pb.get('p')}")
                if "g" in pb and pb["g"] not in ("m", "f", "mf"):
                    errors.append(f"e/{fp.name}:{eid} invalid gender {pb['g']}")
                for s in pb.get("senses") or []:
                    if not s.get("zh"):
                        errors.append(f"e/{fp.name}:{eid} empty sense.zh")
                    else:
                        entry_has_zh = True
                    c = s.get("conf")
                    if c not in (0, 1, 2, 3):
                        errors.append(f"e/{fp.name}:{eid} invalid conf {c}")
                    else:
                        conf_dist[c] += 1
                    ssrcs = s.get("src")
                    if not isinstance(ssrcs, list) or not ssrcs or any(x not in VALID_SOURCES for x in ssrcs):
                        errors.append(f"e/{fp.name}:{eid} invalid sense.src {ssrcs}")
                    for ex in s.get("ex") or []:
                        entry_has_ex = True
                        if not ex.get("fr") or not ex.get("zh"):
                            errors.append(f"e/{fp.name}:{eid} empty example fr/zh")
                        if ex.get("src") not in VALID_SOURCES:
                            errors.append(f"e/{fp.name}:{eid} invalid example src {ex.get('src')}")
                        if "hl" in ex:
                            hl = ex["hl"]
                            u16_len = len(ex["fr"].encode("utf-16-le")) // 2
                            if not (isinstance(hl, list) and len(hl) == 2 and 0 <= hl[0] < hl[1] <= u16_len):
                                errors.append(f"e/{fp.name}:{eid} invalid hl {hl} for len={u16_len}")

            for rk in RELATION_KINDS:
                if rk in entry:
                    rv = entry[rk]
                    if not isinstance(rv, list) or not rv or not all(isinstance(x, str) and x.strip() for x in rv):
                        errors.append(f"e/{fp.name}:{eid} {rk} must be a non-empty string[] (omit when empty)")
                    elif len(set(rv)) != len(rv):
                        errors.append(f"e/{fp.name}:{eid} duplicate items in {rk}")
                    elif rk == "derived" and any(" " in x for x in rv):
                        errors.append(f"e/{fp.name}:{eid} multi-word phrase in derived: {[x for x in rv if ' ' in x][:3]}")
            if set(entry.get("syn") or []) & set(entry.get("ant") or []):
                errors.append(f"e/{fp.name}:{eid} syn and ant overlap")

            for ph in entry.get("phrases") or []:
                if not ph.get("fr") or not ph.get("zh") or ph.get("src") not in VALID_SOURCES or ph.get("conf") not in (0, 1, 2, 3):
                    errors.append(f"e/{fp.name}:{eid} invalid phrase {ph}")

            if entry_has_zh:
                with_zh += 1
            rank = entry.get("rank") or 999999
            is_single = " " not in entry.get("w", "") and "/" not in entry.get("w", "")
            if is_single and rank <= 15000:
                top15k_total += 1
                if entry_has_zh and (entry_has_ex or entry.get("phrases")) and entry.get("frDefs"):
                    top15k_all_sections += 1

            all_entries[eid] = entry

    # 2) Validate forms/<key>.json
    forms_dir = out_dir / "forms"
    for fp in sorted(forms_dir.glob("*.json")):
        sz = fp.stat().st_size
        total_bytes += sz
        if sz > max_shard_bytes:
            max_shard_bytes = sz
            max_shard_name = f"forms/{fp.name}"
        if sz > MAX_SHARD_BYTES:
            errors.append(f"forms/{fp.name} exceeds 400 KB limit ({sz} bytes)")
        shard_key = fp.stem
        data = json.loads(fp.read_text(encoding="utf-8"))
        for ff, targets in data.items():
            if lexdb_key(ff, splits) != shard_key:
                errors.append(f"forms/{fp.name}:{ff} wrong shard (expected {lexdb_key(ff, splits)})")
            if not isinstance(targets, list) or not targets or any(t not in all_entries for t in targets):
                errors.append(f"forms/{fp.name}:{ff} points to unknown entry id in {targets}")

    # 3) Validate zh/<0..63>.json
    zh_dir = out_dir / "zh"
    for b in range(64):
        zp = zh_dir / f"{b}.json"
        if not zp.exists():
            errors.append(f"Missing zh/{b}.json")
            continue
        sz = zp.stat().st_size
        total_bytes += sz
        if sz > max_shard_bytes:
            max_shard_bytes = sz
            max_shard_name = f"zh/{zp.name}"
        data = json.loads(zp.read_text(encoding="utf-8"))
        for term, hits in data.items():
            if zh_bucket(term) != b:
                errors.append(f"zh/{b}.json term {term!r} belongs in bucket {zh_bucket(term)}")
            if len(hits) > 40:
                errors.append(f"zh/{b}.json term {term!r} exceeds 40 hits ({len(hits)})")
            prev_r = -1
            for row in hits:
                if not (isinstance(row, list) and len(row) == 2 and row[0] in all_entries and isinstance(row[1], int)):
                    errors.append(f"zh/{b}.json term {term!r} invalid row {row}")
                    break
                if row[1] < prev_r:
                    errors.append(f"zh/{b}.json term {term!r} not sorted by rank ascending")
                    break
                prev_r = row[1]

    # 4) Validate sharded suggest/*.json (or legacy suggest.json)
    if meta.get("suggestShards"):
        sug_dir = out_dir / "suggest"
        sug_files = sorted(sug_dir.glob("*.json")) if sug_dir.exists() else []
        if not sug_files or not (sug_dir / "top.json").exists():
            errors.append("Missing public/lexdb/suggest/*.json or suggest/top.json")
        else:
            for sp in sug_files:
                sz = sp.stat().st_size
                total_bytes += sz
                if sz > max_shard_bytes:
                    max_shard_bytes = sz
                    max_shard_name = f"suggest/{sp.name}"
                if sz > MAX_SHARD_BYTES:
                    errors.append(f"suggest/{sp.name} exceeds 400 KB limit ({sz} bytes)")
                sug = json.loads(sp.read_text(encoding="utf-8"))
                if not isinstance(sug, list) or not sug:
                    errors.append(f"suggest/{sp.name} is empty or not an array")
                else:
                    for row in sug[:500]:
                        if not (isinstance(row, list) and len(row) == 4 and isinstance(row[0], str) and isinstance(row[1], str) and isinstance(row[2], int) and isinstance(row[3], str)):
                            errors.append(f"suggest/{sp.name} invalid row: {row}")
                            break
    else:
        sug_p = out_dir / "suggest.json"
        if not sug_p.exists():
            errors.append("Missing suggest.json")
        else:
            total_bytes += sug_p.stat().st_size
            sug = json.loads(sug_p.read_text(encoding="utf-8"))
            if not isinstance(sug, list) or not sug:
                errors.append("suggest.json is empty or not an array")
            else:
                for row in sug[:500]:
                    if not (isinstance(row, list) and len(row) == 4 and isinstance(row[0], str) and isinstance(row[1], str) and isinstance(row[2], int) and isinstance(row[3], str)):
                        errors.append(f"suggest.json invalid row: {row}")
                        break

    # 4b) Validate hints/<bucket>.json (relation-target previews)
    hints: dict[str, list] = {}
    if meta.get("hintsShards"):
        hints_dir = out_dir / "hints"
        h_files = sorted(hints_dir.glob("*.json")) if hints_dir.exists() else []
        if not h_files:
            errors.append("meta.hintsShards is true but public/lexdb/hints/*.json is missing")
        for hp in h_files:
            sz = hp.stat().st_size
            if sz > max_shard_bytes:
                max_shard_bytes = sz
                max_shard_name = f"hints/{hp.name}"
            if sz > MAX_SHARD_BYTES:
                errors.append(f"hints/{hp.name} exceeds 400 KB limit ({sz} bytes)")
            bucket = hp.stem
            if not (bucket == "_" or (len(bucket) == 1 and "a" <= bucket <= "z")):
                errors.append(f"hints/{hp.name} invalid bucket name")
            raw = hp.read_bytes()
            data = json.loads(raw)
            if not isinstance(data, dict):
                errors.append(f"hints/{hp.name} is not a JSON object")
                continue
            if compact_json_bytes(data) != raw:
                errors.append(f"hints/{hp.name} is not compact JSON")
            for k, v in data.items():
                if hint_key(k) != k:
                    errors.append(f"hints/{hp.name} key {k!r} is not NFC/trimmed/lowercase")
                if hint_bucket(k) != bucket:
                    errors.append(f"hints/{hp.name} key {k!r} belongs in hints/{hint_bucket(k)}.json")
                if not (isinstance(v, list) and len(v) == 2 and all(isinstance(x, str) for x in v)):
                    errors.append(f"hints/{hp.name} key {k!r} value must be [pos, shortZh]")
                    continue
                if len(v[1]) > HINT_ZH_MAX:
                    errors.append(f"hints/{hp.name} key {k!r} shortZh longer than {HINT_ZH_MAX} chars")
                hints[k] = v
        missing_hints = sorted(
            {x for e in all_entries.values() for rk in RELATION_KINDS for x in e.get(rk) or [] if hint_key(x) not in hints}
        )
        if h_files and missing_hints:
            errors.append(f"{len(missing_hints)} relation targets lack a hints entry, e.g. {missing_hints[:5]}")

    # 4c) Total size of every file under public/lexdb/ (recursive)
    total_bytes = sum(p.stat().st_size for p in out_dir.rglob("*") if p.is_file())

    # 5) Validate pilot 200 entries
    pilot_valid = 0
    pilot_ids = []
    if db_path.exists():
        conn = sqlite3.connect(str(db_path))
        prow = conn.execute("SELECT value FROM report WHERE key = 'pilot_ids'").fetchone()
        if prow:
            pilot_ids = json.loads(prow[0])
            for pid in pilot_ids:
                ent = all_entries.get(pid)
                if not ent:
                    continue
                has_zh = any(s.get("zh") for pb in ent.get("pos", []) for s in pb.get("senses", []))
                if has_zh:
                    pilot_valid += 1
        conn.close()

    by_w = {e["w"]: e for e in all_entries.values()}
    missing_req = [w for w in REQUIRED_PILOT_WORDS if w not in by_w]
    if missing_req:
        errors.append(f"Missing required pilot words in exported entries: {missing_req}")

    if total_bytes >= MAX_TOTAL_BYTES:
        errors.append(f"Total public/lexdb size ({total_bytes / 1024 / 1024:.2f} MiB) reaches the 80 MiB cap")

    # Relation coverage across populations + exact-headword resolution
    atlas_lemmas: set[str] = set()
    lex_p = ROOT / "data/lexicon.json"
    if lex_p.exists():
        lex = json.loads(lex_p.read_text(encoding="utf-8"))
        atlas_lemmas = {norm_rel(c["lemma"]) for c in lex.get("entries", []) if not c.get("aliasOf")}
    headwords = {norm_rel(e["w"]) for e in all_entries.values()} | atlas_lemmas
    pops = {
        "all LexDB": list(all_entries.values()),
        "Atlas-linked LexDB": [e for e in all_entries.values() if e.get("atlasId")],
        "B2-level LexDB": [e for e in all_entries.values() if e.get("level") == "B2"],
    }
    rel_lines = []
    for name, rows in pops.items():
        n = len(rows) or 1
        parts = [f"{rk} {sum(1 for e in rows if e.get(rk)):>6} ({100 * sum(1 for e in rows if e.get(rk)) / n:5.1f}%)" for rk in RELATION_KINDS]
        rel_lines.append(f"  {name:<20} n={len(rows):>6} | " + " | ".join(parts))
    rel_items = [x for e in all_entries.values() for rk in RELATION_KINDS for x in e.get(rk) or []]
    resolved = sum(1 for x in rel_items if norm_rel(x) in headwords)
    pct_resolved = (resolved / len(rel_items) * 100) if rel_items else 100.0

    total_lemmas = len(all_entries)
    pct_zh = (with_zh / total_lemmas * 100) if total_lemmas else 0.0
    pct_top15k = (top15k_all_sections / top15k_total * 100) if top15k_total else 0.0

    print("=== LexDB Check Summary ===")
    print(f"total lemmas         : {total_lemmas}")
    print(f"with zh              : {with_zh} ({pct_zh:.2f}%)")
    print(f"top-15k all sections : {top15k_all_sections}/{top15k_total} ({pct_top15k:.2f}%)")
    print(f"conf distribution    : {conf_dist}")
    print(f"pilot 200 valid count: {pilot_valid}/{len(pilot_ids)}")
    print(f"splits count         : {len(splits)} -> {sorted(splits)}")
    print(f"max shard size       : {max_shard_bytes:,} bytes ({max_shard_bytes / 1024:.1f} KB) [{max_shard_name}]")
    print(f"total public/lexdb   : {total_bytes:,} bytes ({total_bytes / 1024 / 1024:.2f} MiB, all files)")
    print("relation coverage    :")
    for line in rel_lines:
        print(line)
    print(f"exact-headword hits  : {resolved}/{len(rel_items)} relation targets ({pct_resolved:.2f}%) match a LexDB w or Atlas lemma")
    if meta.get("hintsShards"):
        print(f"hints                : {len(hints)} words")

    for w in warnings:
        print(f"WARNING: {w}", file=sys.stderr)
    if errors:
        print(f"FAIL: {len(errors)} error(s) found:", file=sys.stderr)
        for err in errors[:30]:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    print("OK: all schema and size checks passed")


if __name__ == "__main__":
    main()
