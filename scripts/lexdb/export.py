#!/usr/bin/env python3
"""Export data/lexdb/lexdb.sqlite -> public/lexdb/ shards and data/lexdb/spot-check.md.

Strictly adheres to docs/dictionary/ENTRY_SCHEMA.md and src/lib/lexdb/types.ts.
Splits 2-letter prefixes into 3-letter shards whenever e/<k2>.json or forms/<k2>.json > 400 KB.

Usage:
  python3 scripts/lexdb/export.py [--db data/lexdb/lexdb.sqlite] [--out public/lexdb]
"""
from __future__ import annotations

import argparse
import json
import shutil
import sqlite3
import sys
import time
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, VALID_LEVELS, VALID_SOURCES, lexdb_base_key, lexdb_fold, lexdb_key, zh_bucket, zh_tokens

DEFAULT_DB = ROOT / "data/lexdb/lexdb.sqlite"
DEFAULT_OUT = ROOT / "public/lexdb"
SPOT_CHECK_PATH = ROOT / "data/lexdb/spot-check.md"
MAX_SHARD_BYTES = 409_600  # 400 KB


def compact_json(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    t0 = time.time()
    db_path = Path(args.db)
    out_dir = Path(args.out)
    if not db_path.exists():
        raise FileNotFoundError(f"DB not found: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    # 1) Load all lemmas
    lemmas = {}
    for row in conn.execute("SELECT * FROM lemma ORDER BY rank ASC, id ASC"):
        lemmas[row["id"]] = dict(row)

    # 2) Load pos_blocks
    pos_blocks_by_lemma: dict[str, list[dict]] = defaultdict(list)
    pb_by_id: dict[int, dict] = {}
    for row in conn.execute("SELECT * FROM pos_block ORDER BY lemma_id, sort_order, id"):
        d = dict(row)
        pos_blocks_by_lemma[d["lemma_id"]].append(d)
        pb_by_id[d["id"]] = d

    # 3) Load senses
    senses_by_pb: dict[int, list[dict]] = defaultdict(list)
    senses_by_id: dict[int, dict] = {}
    for row in conn.execute("SELECT * FROM sense ORDER BY pos_block_id, sort_order, id"):
        d = dict(row)
        senses_by_pb[d["pos_block_id"]].append(d)
        senses_by_id[d["id"]] = d

    # 4) Load examples (only those with both fr and zh for LexSense.ex)
    examples_by_sense: dict[int, list[dict]] = defaultdict(list)
    examples_by_lemma_fallback: dict[str, list[dict]] = defaultdict(list)
    for row in conn.execute("SELECT * FROM example WHERE zh != '' ORDER BY id"):
        d = dict(row)
        if d["sense_id"] and d["sense_id"] in senses_by_id:
            examples_by_sense[d["sense_id"]].append(d)
        else:
            examples_by_lemma_fallback[d["lemma_id"]].append(d)

    # 5) Load phrases
    phrases_by_lemma: dict[str, list[dict]] = defaultdict(list)
    for row in conn.execute("SELECT * FROM phrase WHERE zh != '' ORDER BY conf DESC, id ASC"):
        phrases_by_lemma[row["lemma_id"]].append(dict(row))

    # 6) Load relations
    rels_by_lemma: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for row in conn.execute("SELECT lemma_id, kind, target FROM relation ORDER BY id"):
        rels_by_lemma[row["lemma_id"]][row["kind"]].append(row["target"])

    # 7) Load fr_def & etym
    frdefs_by_lemma: dict[str, list[dict]] = defaultdict(list)
    for row in conn.execute("SELECT lemma_id, p, gloss, ex FROM fr_def ORDER BY id"):
        frdefs_by_lemma[row["lemma_id"]].append(dict(row))

    etym_by_lemma: dict[str, str] = {}
    for row in conn.execute("SELECT lemma_id, text FROM etym ORDER BY id"):
        if row["lemma_id"] not in etym_by_lemma:
            etym_by_lemma[row["lemma_id"]] = row["text"]

    # 8) Load forms (both display f/pl/fpl and reverse lookup forms/)
    display_forms: dict[str, dict[str, str]] = defaultdict(dict)
    form_lookup: dict[str, list[tuple[int, float, str]]] = defaultdict(list)  # folded_form -> [(rank, -freq, lemma_id)]
    for row in conn.execute("SELECT lemma_id, form, folded_form, tag, freq FROM form"):
        lid = row["lemma_id"]
        lrec = lemmas.get(lid)
        if not lrec:
            continue
        tag = row["tag"]
        if tag in ("f", "pl", "fpl") and tag not in display_forms[lid]:
            display_forms[lid][tag] = row["form"]
        ff = row["folded_form"]
        if ff and ff != lrec["folded"] and len(ff) <= 60:
            form_lookup[ff].append((lrec["rank"] or 999999, -float(row["freq"] or 0), lid))

    # Deduplicate form_lookup targets sorted by (rank asc, freq desc)
    forms_map: dict[str, list[str]] = {}
    for ff, targets in form_lookup.items():
        targets.sort()
        uniq = []
        for _, _, lid in targets:
            if lid not in uniq:
                uniq.append(lid)
            if len(uniq) >= 5:
                break
        if uniq:
            forms_map[ff] = uniq

    # Pilot IDs if recorded
    pilot_row = conn.execute("SELECT value FROM report WHERE key = 'pilot_ids'").fetchone()
    pilot_ids = json.loads(pilot_row["value"]) if pilot_row else []

    # 9) Assemble LexEntry objects & collect counts + zh index + suggest + spot-check
    entries: dict[str, dict] = {}
    conf_counts = {"0": 0, "1": 0, "2": 0, "3": 0}
    with_zh = 0
    top15k_complete = 0
    total_phrases = 0
    zh_index_raw: dict[str, dict[str, int]] = defaultdict(dict)  # zh_term -> {entry_id: best_rank}
    suggest_rows: list[tuple[str, str, int, str]] = []
    spot_check_rows: list[tuple[int, str, str, str, str, int, str, str]] = []
    suggest_seen: set[tuple[str, str]] = set()

    for lid, lrec in lemmas.items():
        rank = lrec["rank"] or 999999
        used_sources = set(json.loads(lrec["sources_json"]))
        pos_list = []
        first_zh_global = ""
        entry_ex_count = 0
        has_any_sense_zh = False
        first_sense_attached_fallback = False

        non_empty_pos = []
        fallback_pos = None
        for pb in pos_blocks_by_lemma.get(lid, []):
            senses_out = []
            for s in senses_by_pb.get(pb["id"], []):
                zh_str = (s["zh_merged"] or "").strip()
                if not zh_str:
                    continue
                has_any_sense_zh = True
                if not first_zh_global:
                    first_zh_global = zh_str
                src_list = [x for x in json.loads(s["src_json"]) if x in VALID_SOURCES]
                if not src_list:
                    src_list = ["wikt-zh"]
                used_sources.update(src_list)
                conf = int(s["conf"]) if s["conf"] in (0, 1, 2, 3) else 1
                conf_counts[str(conf)] += 1

                ex_rows = list(examples_by_sense.get(s["id"], []))
                if not first_sense_attached_fallback and examples_by_lemma_fallback.get(lid):
                    ex_rows.extend(examples_by_lemma_fallback[lid])
                    first_sense_attached_fallback = True
                ex_out = []
                seen_ex_fr = set()
                for ex in ex_rows:
                    efr = ex["fr"].strip()
                    if efr in seen_ex_fr:
                        continue
                    seen_ex_fr.add(efr)
                    esrc = ex["src"] if ex["src"] in VALID_SOURCES else "tatoeba"
                    used_sources.add(esrc)
                    ex_item: dict = {"fr": efr, "zh": ex["zh"].strip(), "src": esrc}
                    if ex["hl_start"] is not None and ex["hl_end"] is not None:
                        ex_item["hl"] = [int(ex["hl_start"]), int(ex["hl_end"])]
                    if ex["ref"]:
                        ex_item["ref"] = ex["ref"]
                    ex_out.append(ex_item)
                    if len(ex_out) >= 3:
                        break
                entry_ex_count += len(ex_out)

                sense_obj: dict = {"zh": zh_str}
                if s["fr"]:
                    sense_obj["fr"] = s["fr"]
                if s["reg"]:
                    sense_obj["reg"] = s["reg"]
                if ex_out:
                    sense_obj["ex"] = ex_out
                sense_obj["src"] = src_list
                sense_obj["conf"] = conf
                senses_out.append(sense_obj)

                # Index zh terms
                for term in zh_tokens(zh_str):
                    prev_r = zh_index_raw[term].get(lid)
                    if prev_r is None or rank < prev_r:
                        zh_index_raw[term][lid] = rank

                if lrec["atlas_id"] and conf <= 1:
                    spot_check_rows.append(
                        (rank, lid, lrec["w"], lrec["atlas_id"], lrec["level"] or "", conf, ",".join(src_list), zh_str)
                    )

            pb_obj: dict = {"p": pb["p"]}
            if pb["g"] in ("m", "f", "mf"):
                pb_obj["g"] = pb["g"]
            pb_obj["senses"] = senses_out
            if senses_out:
                non_empty_pos.append(pb_obj)
            elif fallback_pos is None:
                fallback_pos = pb_obj

        pos_list = non_empty_pos if non_empty_pos else ([fallback_pos] if fallback_pos else [{"p": "n.", "senses": []}])

        # Phrases
        phr_out = []
        for ph in phrases_by_lemma.get(lid, [])[:8]:
            psrc = ph["src"] if ph["src"] in VALID_SOURCES else "wikt-zh"
            pconf = int(ph["conf"]) if ph["conf"] in (0, 1, 2, 3) else 1
            used_sources.add(psrc)
            phr_out.append({"fr": ph["fr"], "zh": ph["zh"], "src": psrc, "conf": pconf})
            total_phrases += 1
            for term in zh_tokens(ph["zh"]):
                prev_r = zh_index_raw[term].get(lid)
                if prev_r is None or rank < prev_r:
                    zh_index_raw[term][lid] = rank
            if lrec["atlas_id"] and pconf <= 1:
                spot_check_rows.append(
                    (rank, lid, lrec["w"], lrec["atlas_id"], lrec["level"] or "", pconf, psrc, f"[phrase] {ph['fr']} = {ph['zh']}")
                )

        # frDefs (rank-tiered caps keep every e/<key>.json <= 400 KB even after full AI enrichment)
        fr_defs_out = []
        raw_frdefs = frdefs_by_lemma.get(lid, [])
        if rank <= 5000:
            for idx, fd in enumerate(raw_frdefs[:2]):
                item = {"p": fd["p"], "gloss": fd["gloss"][:115]}
                if idx == 0 and rank <= 2000 and fd["ex"]:
                    item["ex"] = fd["ex"][:80]
                fr_defs_out.append(item)
        elif rank <= 15000:
            for fd in raw_frdefs[:1]:
                fr_defs_out.append({"p": fd["p"], "gloss": fd["gloss"][:100]})
        elif not has_any_sense_zh:
            for fd in raw_frdefs[:1]:
                fr_defs_out.append({"p": fd["p"], "gloss": fd["gloss"][:85]})
        if fr_defs_out:
            used_sources.add("wikt-fr")

        etym_raw = etym_by_lemma.get(lid)
        etym_str = None
        if etym_raw and rank <= 15000:
            etym_str = etym_raw[:150] if rank <= 5000 else etym_raw[:90]
            used_sources.add("wikt-fr")

        rels = rels_by_lemma.get(lid, {})
        rel_cap = 6 if rank <= 15000 else 4
        syn_list = rels.get("syn", [])[:rel_cap]
        ant_list = rels.get("ant", [])[:rel_cap]
        derived_list = rels.get("derived", [])[:rel_cap]
        confusable_list = rels.get("confusable", [])[:6]

        entry: dict = {
            "id": lid,
            "w": lrec["w"],
        }
        if lrec["ipa"]:
            entry["ipa"] = lrec["ipa"]
        if lrec["level"] in VALID_LEVELS:
            entry["level"] = lrec["level"]
        if lrec["rank"]:
            entry["rank"] = int(lrec["rank"])
        if lrec["atlas_id"]:
            entry["atlasId"] = lrec["atlas_id"]
        if display_forms.get(lid):
            df = display_forms[lid]
            forms_obj = {k: df[k] for k in ("f", "pl", "fpl") if k in df}
            if forms_obj:
                entry["forms"] = forms_obj
        entry["pos"] = pos_list
        if phr_out:
            entry["phrases"] = phr_out
        if syn_list:
            entry["syn"] = syn_list
        if ant_list:
            entry["ant"] = ant_list
        if derived_list:
            entry["derived"] = derived_list
        if lrec["family"]:
            entry["family"] = lrec["family"]
        if fr_defs_out:
            entry["frDefs"] = fr_defs_out
        if etym_str:
            entry["etym"] = etym_str
        if lrec["conj"]:
            entry["conj"] = True
        if confusable_list:
            entry["confusable"] = confusable_list
        entry["sources"] = sorted(s for s in used_sources if s in VALID_SOURCES) or ["lexique"]

        entries[lid] = entry

        if has_any_sense_zh:
            with_zh += 1
        if rank <= 15000 and not lrec["is_phrase"] and has_any_sense_zh and (entry_ex_count > 0 or len(phr_out) > 0) and len(fr_defs_out) > 0:
            top15k_complete += 1

        short_zh = first_zh_global[:24] if first_zh_global else (phr_out[0]["zh"][:24] if phr_out else "")
        skey = (lrec["folded"], lrec["w"])
        if skey not in suggest_seen:
            suggest_seen.add(skey)
            suggest_rows.append((lrec["folded"], lrec["w"], rank, short_zh))

        # Add high-confidence phrases into suggest.json too
        for ph in phr_out[:3]:
            pf = lexdb_fold(ph["fr"])
            pskey = (pf, ph["fr"])
            if pf and pskey not in suggest_seen:
                suggest_seen.add(pskey)
                # Keep multi-word phrase rank behind single words unless already in lemma table
                prank = min(rank + 10000, 99999) if rank < 99999 else 99999
                suggest_rows.append((pf, ph["fr"], prank, ph["zh"][:24]))

    conn.close()

    # 10) Determine 3-letter prefix splits keeping BOTH e/<key>.json and forms/<key>.json <= 400 KB
    e_base: dict[str, dict[str, dict]] = defaultdict(dict)
    for lid, entry in entries.items():
        bk = lexdb_base_key(lexdb_fold(lid))
        e_base[bk][lid] = entry

    f_base: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for ff, targets in forms_map.items():
        bk = lexdb_base_key(ff)
        f_base[bk][ff] = targets

    splits_set: set[str] = set()
    all_base_keys = sorted(set(e_base.keys()) | set(f_base.keys()))
    for bk in all_base_keys:
        if bk == "__":
            continue
        e_sz = len(compact_json(e_base[bk])) if bk in e_base else 0
        f_sz = len(compact_json(f_base[bk])) if bk in f_base else 0
        if e_sz > MAX_SHARD_BYTES or f_sz > MAX_SHARD_BYTES:
            splits_set.add(bk)
    splits = sorted(splits_set)

    # Re-partition e/ and forms/ using splits
    e_shards: dict[str, dict[str, dict]] = defaultdict(dict)
    for lid, entry in entries.items():
        k = lexdb_key(lexdb_fold(lid), splits_set)
        e_shards[k][lid] = entry

    f_shards: dict[str, dict[str, list[str]]] = defaultdict(dict)
    for ff, targets in forms_map.items():
        k = lexdb_key(ff, splits_set)
        f_shards[k][ff] = targets

    # 11) Write output directories cleanly
    for sub in ("e", "forms", "zh"):
        d = out_dir / sub
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True, exist_ok=True)

    for k, shard in e_shards.items():
        (out_dir / "e" / f"{k}.json").write_bytes(compact_json(shard))

    for k, shard in f_shards.items():
        (out_dir / "forms" / f"{k}.json").write_bytes(compact_json(shard))

    # 12) Write zh/<0..63>.json
    zh_buckets: list[dict[str, list[list]]] = [{} for _ in range(64)]
    for term, id_ranks in zh_index_raw.items():
        b = zh_bucket(term)
        ordered = sorted(id_ranks.items(), key=lambda x: (x[1], x[0]))[:40]
        zh_buckets[b][term] = [[eid, r] for eid, r in ordered]
    for b in range(64):
        (out_dir / "zh" / f"{b}.json").write_bytes(compact_json(zh_buckets[b]))

    # 13) Write suggest.json sorted by rank asc
    suggest_rows.sort(key=lambda x: (x[2], x[0], x[1]))
    (out_dir / "suggest.json").write_bytes(compact_json([list(r) for r in suggest_rows]))

    # 14) Write meta.json
    meta = {
        "version": 1,
        "generated": date.today().isoformat(),
        "sources": {
            "atlas": "Mots B2 Atlas (data/lexicon.json)",
            "lexique": "Lexique 3.83 (CC BY-SA 4.0)",
            "wikt-fr": "Wiktionnaire fr via wiktextract (CC BY-SA 4.0)",
            "wikt-zh": "Wiktionary zh / fr-zh (CC BY-SA 4.0)",
            "cfdict": "CFDICT (CC BY-SA 3.0)",
            "omw": "WOLF (OMW-fr, CeCILL-C V1) x Chinese Open Wordnet (OMW-cmn)",
            "tatoeba": "Tatoeba fra-cmn (CC BY 2.0 FR)",
            "ai": "OpenRouter LLM generation",
            "ai-reviewed": "OpenRouter cross-model review",
        },
        "licenses": ["CC BY-SA 4.0", "CC BY 2.0 FR", "CC BY-SA 3.0", "CeCILL-C V1", "WordNet License"],
        "splits": splits,
        "counts": {
            "lemmas": len(entries),
            "withZh": with_zh,
            "top15kComplete": top15k_complete,
            "pilot": len(pilot_ids),
            "phrases": total_phrases,
            "conf": conf_counts,
        },
    }
    (out_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # 15) Generate data/lexdb/spot-check.md (atlas words with conf <= 1)
    spot_check_rows.sort(key=lambda x: (x[0], x[1], x[5]))
    SPOT_CHECK_PATH.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# LexDB Atlas Spot Check (conf <= 1)",
        "",
        f"Generated: {date.today().isoformat()} | Rows: {len(spot_check_rows)} (atlas entries with uncorroborated or AI-reviewed extra senses/phrases where `conf <= 1`).",
        "",
        "| Rank | ID | Lemma | Atlas ID | Level | Conf | Sources | Gloss / Phrase |",
        "|---:|---|---|---|---|---:|---|---|",
    ]
    for rk, lid, w, aid, lvl, c, sstr, txt in spot_check_rows:
        safe_txt = txt.replace("|", "\\|").replace("\n", " ")
        lines.append(f"| {rk} | `{lid}` | {w} | `{aid}` | {lvl} | {c} | {sstr} | {safe_txt} |")
    SPOT_CHECK_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(
        f"[export] done in {time.time() - t0:.1f}s: lemmas={len(entries)}, withZh={with_zh}, "
        f"splits={len(splits)} ({splits[:12]}{'...' if len(splits) > 12 else ''}), "
        f"e_shards={len(e_shards)}, forms_shards={len(f_shards)}, suggest={len(suggest_rows)}, "
        f"spot_check_rows={len(spot_check_rows)}",
        flush=True,
    )


if __name__ == "__main__":
    main()
