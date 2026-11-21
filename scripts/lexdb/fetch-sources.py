#!/usr/bin/env python3
"""Fetch open bilingual/French dictionary sources into references/lexdb/ and verify licenses.

Sources:
1. zh.wiktionary (kaikki.org zhwiktionary wiktextract dump, CC BY-SA 4.0 / GFDL)
   Streamed from https://kaikki.org/zhwiktionary/raw-wiktextract-data.jsonl.gz,
   filtered to lang_code == "fr" -> references/lexdb/zhwikt-fr.jsonl.gz
2. CFDICT (chine.in, Creative Commons BY-SA 3.0)
   Downloaded from https://chine.in/assets/cfdict/cfdict.u8 -> references/lexdb/cfdict.u8
3. OMW omw-fr (WOLF) + omw-cmn (Chinese Open Wordnet) via python `wn` package
   Stored in references/lexdb/wn_data and exported to references/lexdb/omw-fr-cmn.jsonl

Usage:
  python3 scripts/lexdb/fetch-sources.py [--only zhwikt,cfdict,omw] [--force]
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
REF_DIR = ROOT / "references/lexdb"
META_PATH = REF_DIR / "fetch-meta.json"

ZHWIKT_URL = "https://kaikki.org/zhwiktionary/raw-wiktextract-data.jsonl.gz"
ZHWIKT_PAGE = "https://kaikki.org/zhwiktionary/rawdata.html"
CFDICT_URL = "https://chine.in/assets/cfdict/cfdict.u8"
CFDICT_PAGE = "https://chine.in/mandarin/dictionnaire/CFDICT/"
UA = "mots-b2-lexdb/1.0 (+https://github.com/Newsworld-niu/mots-b2)"


def fetch_cfdict(force: bool) -> dict:
    out = REF_DIR / "cfdict.u8"
    if force or not out.exists() or out.stat().st_size < 100_000:
        print(f"[cfdict] downloading {CFDICT_URL} ...", flush=True)
        req = urllib.request.Request(CFDICT_URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        out.write_bytes(data)

    text = out.read_text(encoding="utf-8", errors="replace")
    header_lines = [ln for ln in text.splitlines()[:40] if ln.startswith("#")]
    header = "\n".join(header_lines)
    if "creativecommons.org/licenses/by-sa/" not in header.lower():
        raise RuntimeError("CFDICT license verification failed: CC BY-SA link missing in header")

    ver_m = re.search(r"Version\s*:\s*([^\r\n]+)", header)
    lic_m = re.search(r"Licence\s*:\s*(https?://\S+)", header)
    entries = sum(1 for ln in text.splitlines() if ln and not ln.startswith("#"))
    info = {
        "status": "ok",
        "url": CFDICT_URL,
        "page": CFDICT_PAGE,
        "license": lic_m.group(1) if lic_m else "CC BY-SA 3.0",
        "version": ver_m.group(1).strip() if ver_m else "",
        "entries": entries,
        "bytes": out.stat().st_size,
        "file": str(out.relative_to(ROOT)),
    }
    print(f"[cfdict] OK: {entries} entries, {info['bytes']} bytes, license={info['license']}", flush=True)
    return info


def fetch_zhwikt(force: bool) -> dict:
    out = REF_DIR / "zhwikt-fr.jsonl.gz"
    if force or not out.exists() or out.stat().st_size < 10_000:
        print(f"[zhwikt] streaming {ZHWIKT_URL} (filter lang_code=='fr') ...", flush=True)
        # Verify page license notice first
        req = urllib.request.Request("https://kaikki.org/zhwiktionary/", headers={"User-Agent": UA})
        page_html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
        if "cc-by-sa" not in page_html.lower():
            raise RuntimeError("zhwiktionary license verification failed on kaikki.org")

        tmp = REF_DIR / "zhwikt-fr.jsonl.gz.tmp"
        curl_cmd = ["curl", "-fsSL", "--retry", "3", "-A", UA, ZHWIKT_URL]
        gzip_cmd = ["gzip", "-dc"]
        p_curl = subprocess.Popen(curl_cmd, stdout=subprocess.PIPE)
        p_gzip = subprocess.Popen(gzip_cmd, stdin=p_curl.stdout, stdout=subprocess.PIPE)
        assert p_curl.stdout is not None and p_gzip.stdout is not None
        p_curl.stdout.close()

        total_lines = 0
        kept = 0
        with gzip.open(tmp, "wb") as gz_out:
            for raw in p_gzip.stdout:
                total_lines += 1
                if b'"fr"' not in raw:
                    continue
                try:
                    obj = json.loads(raw)
                except ValueError:
                    continue
                if obj.get("lang_code") == "fr":
                    gz_out.write(raw)
                    kept += 1
                if total_lines % 500_000 == 0:
                    print(f"  [zhwikt] scanned {total_lines:,} lines, kept {kept:,} fr entries...", flush=True)

        rc_gzip = p_gzip.wait()
        rc_curl = p_curl.wait()
        if rc_curl != 0 or rc_gzip != 0:
            tmp.unlink(missing_ok=True)
            raise RuntimeError(f"zhwikt stream failed: curl={rc_curl}, gzip={rc_gzip}")
        tmp.replace(out)
    else:
        total_lines = -1
        with gzip.open(out, "rt", encoding="utf-8") as fh:
            kept = sum(1 for _ in fh)

    info = {
        "status": "ok",
        "url": ZHWIKT_URL,
        "page": ZHWIKT_PAGE,
        "license": "CC BY-SA 4.0 / GFDL (zh.wiktionary.org via kaikki.org)",
        "total_scanned": total_lines,
        "fr_entries": kept,
        "bytes": out.stat().st_size,
        "file": str(out.relative_to(ROOT)),
    }
    print(f"[zhwikt] OK: {kept} fr entries, {info['bytes']} bytes", flush=True)
    return info


def export_omw(force: bool) -> dict:
    out = REF_DIR / "omw-fr-cmn.jsonl"
    wn_dir = REF_DIR / "wn_data"
    db_path = wn_dir / "wn.db"

    if not force and out.exists() and out.stat().st_size > 10_000 and META_PATH.exists():
        prev = json.loads(META_PATH.read_text(encoding="utf-8")).get("sources", {}).get("omw", {})
        if prev.get("status") == "ok" and prev.get("lexicons"):
            print(f"[omw] cached: {prev.get('synset_pairs')} pairs", flush=True)
            return prev

    venv_py = REF_DIR / ".venv/bin/python"
    if not db_path.exists():
        if not venv_py.exists():
            print("[omw] creating venv and installing wn ...", flush=True)
            subprocess.run([sys.executable, "-m", "venv", str(REF_DIR / ".venv")], check=True)
            subprocess.run([str(venv_py), "-m", "pip", "install", "--quiet", "wn"], check=True)
        wn_dir.mkdir(parents=True, exist_ok=True)
        dl_code = f"""
import pathlib, wn
wn.config.data_directory = {str(wn_dir.resolve())!r}
installed = {{(l.id, l.version) for l in wn.lexicons()}}
for pkg in ("omw-fr:1.4", "omw-cmn:1.4"):
    pid, ver = pkg.split(":")
    if (pid, ver) not in installed:
        wn.download(pkg)
"""
        subprocess.run([str(venv_py), "-c", dl_code], check=True)

    import sqlite3
    conn = sqlite3.connect(str(db_path))
    lex_meta = {}
    lex_ids = {}
    for rowid, spec, lid, label, lang, lic, ver, url, cit in conn.execute(
        "SELECT rowid, specifier, id, label, language, license, version, url, citation FROM lexicons"
    ):
        lex_meta[spec] = {
            "id": lid,
            "version": ver,
            "language": lang,
            "label": label,
            "license": lic,
            "url": url,
            "citation": cit,
        }
        lex_ids[lid] = rowid

    if "omw-fr" not in lex_ids or "omw-cmn" not in lex_ids:
        raise RuntimeError(f"Missing omw-fr or omw-cmn in wn.db: {list(lex_ids)}")

    # Query Chinese lemmas per ILI
    ili_to_cmn: dict[str, list[str]] = {}
    for ili_id, lemma in conn.execute(
        """
        SELECT i.id, f.form
        FROM synsets sy
        JOIN ilis i ON i.rowid = sy.ili_rowid
        JOIN senses se ON se.synset_rowid = sy.rowid
        JOIN forms f ON f.entry_rowid = se.entry_rowid AND f.rank = 0
        WHERE sy.lexicon_rowid = ?
        ORDER BY se.synset_rank, se.rowid
        """,
        (lex_ids["omw-cmn"],),
    ):
        if lemma:
            lst = ili_to_cmn.setdefault(ili_id, [])
            if lemma not in lst:
                lst.append(lemma)

    # Query French synsets -> lemmas, POS, ILI
    fr_synsets: dict[tuple[str, str, str], list[str]] = {}
    for syn_id, ili_id, pos, lemma in conn.execute(
        """
        SELECT sy.id, i.id, sy.pos, f.form
        FROM synsets sy
        JOIN ilis i ON i.rowid = sy.ili_rowid
        JOIN senses se ON se.synset_rowid = sy.rowid
        JOIN forms f ON f.entry_rowid = se.entry_rowid AND f.rank = 0
        WHERE sy.lexicon_rowid = ?
        ORDER BY sy.rowid, se.synset_rank, se.rowid
        """,
        (lex_ids["omw-fr"],),
    ):
        if ili_id in ili_to_cmn and lemma:
            key = (syn_id, ili_id, pos or "")
            lst = fr_synsets.setdefault(key, [])
            if lemma not in lst:
                lst.append(lemma)
    conn.close()

    count = 0
    with out.open("w", encoding="utf-8") as fh:
        for (syn_id, ili_id, pos), fr_words in fr_synsets.items():
            rec = {"ili": ili_id, "pos": pos, "fr": fr_words, "zh": ili_to_cmn[ili_id]}
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count += 1

    info = {
        "status": "ok",
        "lexicons": lex_meta,
        "synset_pairs": count,
        "bytes": out.stat().st_size,
        "file": str(out.relative_to(ROOT)),
    }
    print(f"[omw] OK: {count} fr-cmn synset pairs, {info['bytes']} bytes", flush=True)
    return info


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="zhwikt,cfdict,omw", help="Comma-separated sources to fetch")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    want = {s.strip() for s in args.only.split(",") if s.strip()}

    REF_DIR.mkdir(parents=True, exist_ok=True)
    meta = json.loads(META_PATH.read_text(encoding="utf-8")) if META_PATH.exists() else {}
    meta["updated_at"] = datetime.now(timezone.utc).isoformat()
    meta.setdefault("sources", {})

    if "cfdict" in want:
        try:
            meta["sources"]["cfdict"] = fetch_cfdict(args.force)
        except Exception as e:
            meta["sources"]["cfdict"] = {"status": "failed", "error": str(e)}
            print(f"[cfdict] FAILED: {e}", file=sys.stderr, flush=True)

    if "zhwikt" in want:
        try:
            meta["sources"]["zhwikt"] = fetch_zhwikt(args.force)
        except Exception as e:
            meta["sources"]["zhwikt"] = {"status": "failed", "error": str(e)}
            print(f"[zhwikt] FAILED: {e}", file=sys.stderr, flush=True)

    if "omw" in want:
        try:
            meta["sources"]["omw"] = export_omw(args.force)
        except Exception as e:
            meta["sources"]["omw"] = {"status": "failed", "error": str(e)}
            print(f"[omw] FAILED: {e}", file=sys.stderr, flush=True)

    META_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {META_PATH.relative_to(ROOT)}", flush=True)


if __name__ == "__main__":
    main()
