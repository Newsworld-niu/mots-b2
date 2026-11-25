#!/usr/bin/env python3
"""Deterministically enrich shipped LexDB shards with clean `derived` / `syn` / `ant` relations.

The shipped public/lexdb/ shards are the immutable baseline (ids, headwords, ipa, level, rank, atlasId, pos/senses/
examples, phrases, frDefs, etym, conj, confusable, zh/ and suggest/ shards). This script only rewrites the
relation lists (and fills missing display `forms`), re-shards e/ + forms/ with the export.py 2 -> 3 -> 4 prefix
loop, exports public/lexdb/hints/<bucket>.json, updates meta.json, propagates high-confidence relations into
data/lexicon.json, rebuilds public/atlas/families.json (scripts/build-families.py) and writes
data/lexdb/relations-report.json.

Sources (raw downloads cached in gitignored references/lexdb/relations/):
  wikt       Kaikki en.wiktionary French (derived / related / etymology affix templates / synonyms / antonyms / forms)
             + MorphyNet fra.derivational.v1 + the shipped fr.wiktionnaire lists  -> ONE "Wiktionary" lineage
  cnrtl      data/lexdb/crawled-relations.jsonl (CRISCO DES syn/ant ranked + ATILF morphological family graph)
  frdic      data/lexdb/crawled-relations.jsonl (近义词 / 反义词 / 派生 / 副词变化)
  atlas      data/lexicon.json fam/syn/ant + public/atlas/families.json
  omw        OMW 1.4 omw-fr (WOLF) same-ILI synsets + omw-en antonym links projected through ILI

Usage:
  python3 scripts/lexdb/enrich-relations.py [--download] [--dry-run]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tarfile
import time
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import (  # noqa: E402
    ROOT,
    SOURCE_DESCRIPTIONS,
    SOURCE_LICENSES,
    build_hint_shards,
    compact_json_bytes,
    write_hint_shards,
    lexdb_fold,
    lexdb_key,
    load_lexdb_entries,
    load_lexdb_forms,
    nfc,
    short_hint_zh,
)

OUT = ROOT / "public/lexdb"
LEXICON = ROOT / "data/lexicon.json"
FAMILIES = ROOT / "public/atlas/families.json"
CRAWL = ROOT / "data/lexdb/crawled-relations.jsonl"
REPORT = ROOT / "data/lexdb/relations-report.json"
REL_DIR = ROOT / "references/lexdb/relations"
MAX_SHARD_BYTES = 409_600
# Pre-enrichment commit: its shipped relation lists, lexicon fam/syn/ant and families.json are read back from git as
# the "shipped"/"atlas" inputs, so re-running this script is idempotent (it never re-ingests its own output).
BASELINE_REF = "42dd1c31296819b1a42558269b7923b965c436a2"

DOWNLOADS = {
    "kaikki/kaikki.org-dictionary-French.jsonl.gz": "https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl.gz",
    "morphynet/fra.derivational.v1.tsv": "https://raw.githubusercontent.com/kbatsuren/MorphyNet/main/fra/fra.derivational.v1.tsv",
    "omw/omw-fr-1.4.tar.xz": "https://github.com/omwn/omw-data/releases/download/v1.4/omw-fr-1.4.tar.xz",
    "omw/omw-en-1.4.tar.xz": "https://github.com/omwn/omw-data/releases/download/v1.4/omw-en-1.4.tar.xz",
}

KAIKKI_POS = {"noun": "n", "verb": "v", "adj": "adj", "adv": "adv", "prep": "prép", "conj": "conj", "pron": "pron", "intj": "interj"}
MORPHY_POS = {"N": "n", "V": "v", "J": "adj", "R": "adv"}
CNRTL_POS = {"nom": "n", "verbe": "v", "adjectif": "adj", "adverbe": "adv"}
OMW_POS = {"n": "n", "v": "v", "a": "adj", "s": "adj", "r": "adv"}
SKIP_SENSE_TAGS = {"archaic", "obsolete", "dated", "historical", "form-of", "alt-of", "abbreviation", "Louisiana", "misspelling"}
SKIP_SENSE_TOPICS = {"computing", "Internet", "programming", "software"}
AFFIX_TEMPLATES = {"af", "affix", "suffix", "suf", "prefix", "pre", "compound", "com", "confix", "con", "deverbal", "surf"}
ETY_AFFIX_KINDS = {":af", ":affix", ":suffix", ":prefix", ":compound", ":confix", ":deverbal", ":bf", ":surf"}

# Known homograph / folk-etymology root collisions that must not cross-link learner families or antonyms
_FALSE_FAMILY_SPLITS = (
    (
        {"tache", "tacher", "taché", "entacher", "entachement", "détachant"},
        {
            "attacher", "attache", "attaché", "attachant", "attachement",
            "détacher", "détaché", "détachement", "détachable",
            "rattacher", "rattachement", "inattachable",
        },
    ),
    (
        {"lion", "lionne", "lionceau"},
        {"lu", "lire", "relire", "lisible", "illisible", "lecteur", "lecture", "délire", "délirer", "élire", "élection"},
    ),
    (
        {"arriver", "arrivée", "arriviste", "arrivisme"},
        {"rive", "river", "rivage", "riverain", "dériver", "dérive", "dérivation"},
    ),
    (
        {"bras", "brassard", "embrasser", "embrassade"},
        {"brasser", "brasseur", "brasserie", "brassage"},
    ),
)
BAD_DERIVED_PAIRS: set[tuple[str, str]] = set()
for _g1, _g2 in _FALSE_FAMILY_SPLITS:
    for _a in _g1:
        for _b in _g2:
            BAD_DERIVED_PAIRS.add((_a, _b))
            BAD_DERIVED_PAIRS.add((_b, _a))

BAD_ANT_PAIRS: set[tuple[str, str]] = {
    ("comptable", "massif"),
    ("massif", "comptable"),
}


def t0p(msg: str, t0: float) -> None:
    print(f"[enrich {time.time() - t0:6.1f}s] {msg}", flush=True)


def coarse(p: str) -> str:
    p = (p or "").strip()
    if p.startswith("n."):
        return "n"
    if p.startswith("loc"):
        return "loc"
    return p.rstrip(".") or "?"


def norm_word(w: str) -> str:
    """Lowercase NFC key with typographic apostrophes folded (used to resolve to exact headwords)."""
    return re.sub(r"\s+", " ", nfc(w or "").strip().replace("’", "'").replace("‘", "'")).lower()


def share_stem(a: str, b: str, n: int = 4) -> bool:
    """True when two words share a folded substring of length >= n (or the shorter word, if shorter than n)."""
    fa, fb = lexdb_fold(a), lexdb_fold(b)
    if len(fa) < n or len(fb) < n:
        short, other = (fa, fb) if len(fa) <= len(fb) else (fb, fa)
        return len(short) >= 3 and short[:3] in other
    return any(fa[i : i + n] in fb for i in range(len(fa) - n + 1))


def is_affix(w: str) -> bool:
    return not w or w.startswith("-") or w.endswith("-") or w.startswith("*")


def git_blobs(ref: str, paths: list[str]) -> dict[str, bytes]:
    """Read many files at a git ref in one `git cat-file --batch` round trip."""
    proc = subprocess.run(
        ["git", "cat-file", "--batch"],
        input="".join(f"{ref}:{p}\n" for p in paths).encode(),
        capture_output=True,
        cwd=ROOT,
        check=True,
    )
    out: dict[str, bytes] = {}
    buf = proc.stdout
    pos = 0
    for p in paths:
        nl = buf.index(b"\n", pos)
        header = buf[pos:nl].split()
        pos = nl + 1
        if len(header) >= 2 and header[1] == b"missing":
            continue
        size = int(header[2])
        out[p] = buf[pos : pos + size]
        pos += size + 1
    return out


def load_baseline_inputs(ref: str) -> tuple[dict[str, dict], dict[str, list[str]], list[dict], list[dict]] | None:
    """(entry mutable baseline, reverse forms map, lexicon cards, families) as shipped at `ref`; None if unavailable."""
    try:
        e_names = subprocess.run(
            ["git", "ls-tree", "--name-only", f"{ref}:public/lexdb/e"], capture_output=True, cwd=ROOT, check=True, text=True
        ).stdout.split()
        f_names = subprocess.run(
            ["git", "ls-tree", "--name-only", f"{ref}:public/lexdb/forms"], capture_output=True, cwd=ROOT, check=True, text=True
        ).stdout.split()
        e_paths = [f"public/lexdb/e/{n}" for n in e_names]
        f_paths = [f"public/lexdb/forms/{n}" for n in f_names]
        paths = e_paths + f_paths + ["data/lexicon.json", "public/atlas/families.json"]
        blobs = git_blobs(ref, paths)
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        return None
    rels: dict[str, dict] = {}
    for p in e_paths:
        for eid, e in json.loads(blobs[p]).items():
            rels[eid] = {
                k: e[k]
                for k in ("derived", "syn", "ant", "forms", "family", "sources")
                if k in e and e[k] is not None
            }
    forms_map: dict[str, list[str]] = {}
    for p in f_paths:
        forms_map.update(json.loads(blobs[p]))
    cards = [c for c in json.loads(blobs["data/lexicon.json"])["entries"] if not c.get("aliasOf")]
    fams = json.loads(blobs["public/atlas/families.json"])
    return rels, forms_map, cards, fams


def download(force: bool = False) -> None:
    for rel, url in DOWNLOADS.items():
        dest = REL_DIR / rel
        if dest.exists() and not force:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        tmp.unlink(missing_ok=True)
        print(f"[download] {url}", flush=True)
        subprocess.run(["curl", "-sSL", "--fail", "-o", str(tmp), url], check=True)
        tmp.replace(dest)
    for name in ("omw-fr", "omw-en"):
        xml = REL_DIR / f"omw/{name}/{name}.xml"
        if not xml.exists():
            with tarfile.open(REL_DIR / f"omw/{name}-1.4.tar.xz") as tf:
                tf.extractall(REL_DIR / "omw", filter="data")


# ------------------------------------------------------------------------------------------- baseline
class Baseline:
    def __init__(self, t0: float, require_baseline: bool = False):
        self.meta = json.loads((OUT / "meta.json").read_text(encoding="utf-8"))
        self.entries = load_lexdb_entries(OUT)
        self.forms_map = load_lexdb_forms(OUT)
        assert len(self.entries) >= 41_000, f"refusing to run on incomplete LexDB ({len(self.entries)} entries < 41,000)"
        shipped = load_baseline_inputs(BASELINE_REF)
        if shipped is None:
            if require_baseline:
                raise RuntimeError(f"git baseline {BASELINE_REF} unavailable")
            print(f"WARNING: git ref {BASELINE_REF[:8]} unavailable; using current files as shipped inputs", flush=True)
            self.orig_rel = {
                eid: {k: e[k] for k in ("derived", "syn", "ant", "forms", "family", "sources") if k in e}
                for eid, e in self.entries.items()
            }
            lex_now = json.loads(LEXICON.read_text(encoding="utf-8"))
            self.orig_cards = [dict(c) for c in lex_now["entries"] if not c.get("aliasOf")]
            self.orig_families = json.loads(FAMILIES.read_text(encoding="utf-8"))
        else:
            self.orig_rel, orig_forms_map, self.orig_cards, self.orig_families = shipped
            assert set(self.entries) == set(self.orig_rel), (
                f"entry ID mismatch vs baseline {BASELINE_REF[:8]}: "
                f"{len(self.entries)} current vs {len(self.orig_rel)} baseline"
            )
            self.forms_map = {ff: list(ids) for ff, ids in orig_forms_map.items()}
            for eid, e in self.entries.items():
                orig_e = self.orig_rel[eid]
                for k in ("derived", "syn", "ant", "forms", "family", "sources"):
                    if k in orig_e:
                        e[k] = json.loads(json.dumps(orig_e[k]))
                    else:
                        e.pop(k, None)
            t0p(
                f"shipped inputs from git {BASELINE_REF[:8]}: {len(self.orig_rel)} entries, "
                f"{len(self.forms_map)} reverse forms, {len(self.orig_cards)} cards, {len(self.orig_families)} families",
                t0,
            )
        # Drop any self-identical display forms (e.g. jolie.forms.pl == "jolie")
        for e in self.entries.values():
            if "forms" in e:
                cleaned_fo = {k: v for k, v in (e.get("forms") or {}).items() if v and v != e["w"]}
                if cleaned_fo:
                    e["forms"] = cleaned_fo
                else:
                    e.pop("forms", None)
        t0p(f"baseline: {len(self.entries)} entries, {len(self.forms_map)} reverse forms", t0)
        lex = json.loads(LEXICON.read_text(encoding="utf-8"))
        self.lexicon = lex
        self.cards = [e for e in lex["entries"] if not e.get("aliasOf")]
        self.card_by_id = {c["id"]: c for c in self.cards}

        # exact-headword index: norm key -> [entry ids] by rank
        self.by_key: dict[str, list[str]] = defaultdict(list)
        for eid, e in self.entries.items():
            self.by_key[norm_word(e["w"])].append(eid)
        for k in self.by_key:
            self.by_key[k].sort(key=lambda i: (self.entries[i].get("rank") or 999999, "#" in i, i))
        self.pos_of = {eid: {coarse(pb.get("p", "")) for pb in e.get("pos") or []} for eid, e in self.entries.items()}
        self.atlas_by_key: dict[str, list[dict]] = defaultdict(list)
        for c in self.cards:
            self.atlas_by_key[norm_word(c["lemma"])].append(c)
        self.atlas_keys = set(self.atlas_by_key)
        self.atlas_linked_keys = {norm_word(e["w"]) for e in self.entries.values() if e.get("atlasId")}
        # inflected forms (folded) of each entry id -- from the reverse forms/ index and display forms
        self.infl_of: dict[str, set[str]] = defaultdict(set)
        for ff, ids in self.forms_map.items():
            for i in ids:
                self.infl_of[i].add(ff)
        for eid, e in self.entries.items():
            for v in (e.get("forms") or {}).values():
                self.infl_of[eid].add(lexdb_fold(v))
        self.lemma_of_form: dict[str, set[str]] = defaultdict(set)
        for eid, fs in self.infl_of.items():
            for ff in fs:
                self.lemma_of_form[ff].add(eid)

    def known(self, key: str) -> bool:
        return key in self.by_key or key in self.atlas_keys

    def canon(self, key: str) -> str:
        if key in self.by_key:
            e = self.entries[self.by_key[key][0]]
            return nfc(e["w"]).replace("’", "'") if "'" in key else nfc(e["w"])
        return nfc(self.atlas_by_key[key][0]["lemma"])

    def target_pos(self, key: str) -> set[str]:
        out: set[str] = set()
        for i in self.by_key.get(key, []):
            out |= self.pos_of[i]
        for c in self.atlas_by_key.get(key, []):
            out.add(coarse(c.get("pos", "")))
        return out

    def target_rank(self, key: str) -> int:
        ids = self.by_key.get(key)
        return (self.entries[ids[0]].get("rank") or 999999) if ids else 999999

    def entries_for(self, key: str, pos: set[str] | None) -> list[str]:
        """Entries with this exact headword; restricted to POS-compatible homographs when a POS is known."""
        ids = self.by_key.get(key, [])
        if not ids:
            return []
        if pos:
            hit = [i for i in ids if self.pos_of[i] & pos]
            if hit:
                return hit
            return []
        return ids


# ------------------------------------------------------------------------------------------- candidates
class Store:
    """Directed derivation edges, undirected relatedness, and syn/ant candidates per entry id."""

    def __init__(self):
        # edges[base_key][der_key] = {"lin": set, "bpos": set, "dpos": set}
        self.edges: dict[str, dict[str, dict]] = defaultdict(dict)
        self.related: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        self.family_peers: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        # rel[eid][kind][target_key] = {"lin": set, "score": int}
        self.rel: dict[str, dict[str, dict[str, dict]]] = defaultdict(lambda: defaultdict(dict))
        self.edges_rev: dict[str, set[str]] = defaultdict(set)

    def edge(self, base: str, der: str, lin: str, bpos: str | None = None, dpos: str | None = None) -> None:
        if not base or not der or base == der or is_affix(base) or is_affix(der) or (base, der) in BAD_DERIVED_PAIRS:
            return
        d = self.edges[base].setdefault(der, {"lin": set(), "bpos": set(), "dpos": set()})
        d["lin"].add(lin)
        if bpos:
            d["bpos"].add(bpos)
        if dpos:
            d["dpos"].add(dpos)

    def relate(self, a: str, b: str, lin: str, need_stem: bool = False) -> None:
        if (a, b) in BAD_DERIVED_PAIRS:
            return
        if need_stem and not share_stem(a, b):
            return  # uncurated "related" lists also hold semantic neighbours (beau ~ joli): require a shared stem
        if a and b and a != b and not is_affix(a) and not is_affix(b):
            self.related[a][b].add(lin)
            self.related[b][a].add(lin)

    def peer(self, a: str, b: str, lin: str, need_stem: bool = False) -> None:
        if (a, b) in BAD_DERIVED_PAIRS:
            return
        if need_stem and not share_stem(a, b):
            return
        if a and b and a != b:
            self.family_peers[a][b].add(lin)

    def add(self, eid: str, kind: str, target: str, lin: str, score: int = 0) -> None:
        if not target:
            return
        c = self.rel[eid][kind].setdefault(target, {"lin": set(), "score": 0, "cs": -1})
        c["lin"].add(lin)
        c["score"] = max(c["score"], score)
        if lin == "cnrtl":
            c["cs"] = max(c["cs"], score)
        if lin == "omw":
            c["omw"] = max(c.get("omw", 0), score)


def load_kaikki(base: Baseline, store: Store, t0: float) -> dict[tuple[str, str], dict[str, str]]:
    """Stream Kaikki French once. Returns unambiguous display forms {(exact_word, pos): {f/pl/fpl}} for nouns/adjectives."""
    path = REL_DIR / "kaikki/kaikki.org-dictionary-French.jsonl.gz"
    form_cands: dict[tuple[str, str], dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    if not path.exists():
        print(f"WARNING: {path} missing (run with --download)", flush=True)
        return {}
    targets = set(base.by_key) | base.atlas_keys
    skip_form_tags = {
        "obsolete", "archaic", "dated", "rare", "nonstandard", "before-vowel", "alternative",
        "informal", "colloquial", "slang", "regional", "dialectal", "multiword-construction", "error-lua-exec",
    }
    proc = subprocess.Popen(["gzip", "-dc", str(path)], stdout=subprocess.PIPE)
    assert proc.stdout is not None
    n = used = 0
    for raw in proc.stdout:
        n += 1
        try:
            d = json.loads(raw)
        except ValueError:
            continue
        raw_w = nfc(d.get("word") or "").strip()
        if not raw_w:
            continue
        wk = norm_word(raw_w)
        if wk not in targets:
            continue
        pos = KAIKKI_POS.get(d.get("pos") or "")
        if not pos:
            continue
        senses = d.get("senses") or []
        if senses and all(("form-of" in (s.get("tags") or [])) or s.get("form_of") for s in senses):
            continue  # inflected-form entry, never a relation source
        used += 1
        w = wk
        for it in d.get("derived") or []:
            dk = norm_word(it.get("word") or "")
            if dk and " " not in dk and dk != w:
                store.edge(w, dk, "wikt:kaikki", pos, None)
        for it in d.get("related") or []:
            rk = norm_word(it.get("word") or "")
            if rk and " " not in rk:
                store.relate(w, rk, "wikt:kaikki", need_stem=True)
        for tpl in d.get("etymology_templates") or []:
            name = tpl.get("name") or ""
            args = tpl.get("args") or {}
            if name in AFFIX_TEMPLATES and args.get("1") == "fr":
                parts = [args[k] for k in sorted((k for k in args if k.isdigit() and int(k) >= 2), key=int)]
            elif name == "ety" and args.get("1") == "fr" and re.sub(r"<.*$", "", str(args.get("2") or "")) in ETY_AFFIX_KINDS:
                parts = [args[k] for k in sorted((k for k in args if k.isdigit() and int(k) >= 3), key=int)]
            else:
                continue
            for part in parts:
                part = re.sub(r"<[^>]*>", "", str(part)).strip()
                if not part or ":" in part or "<" in part or "[" in part:
                    continue
                pk = norm_word(part)
                if pk != w and not is_affix(pk) and " " not in pk and re.fullmatch(r"[^\W\d_][\w'\-]*", pk):
                    store.edge(pk, w, "wikt:kaikki", None, pos)
        for scope, tags, topics in [(d, set(), set())] + [
            (s, set(s.get("tags") or []), set(s.get("topics") or [])) for s in senses
        ]:
            if tags & SKIP_SENSE_TAGS or topics & SKIP_SENSE_TOPICS:
                continue
            for kind, field in (("syn", "synonyms"), ("ant", "antonyms")):
                for it in scope.get(field) or []:
                    itags = set(it.get("tags") or [])
                    if itags & SKIP_SENSE_TAGS or set(it.get("topics") or []) & SKIP_SENSE_TOPICS:
                        continue
                    tk = norm_word(it.get("word") or "")
                    for eid in base.entries_for(w, {pos}):
                        store.add(eid, kind, tk, "wikt:kaikki")
        if pos in ("n", "adj"):
            for fm in d.get("forms") or []:
                ftags = set(fm.get("tags") or [])
                form = nfc(fm.get("form") or "").strip()
                if not form or " " in form or len(form) > 40 or (ftags & skip_form_tags):
                    continue
                if raw_w.islower() and not form.islower():
                    continue
                tag = None
                if "feminine" in ftags and "plural" in ftags:
                    tag = "fpl"
                elif "feminine" in ftags and pos == "adj":
                    tag = "f"
                elif "plural" in ftags and "feminine" not in ftags:
                    tag = "pl"
                if tag:
                    form_cands[(raw_w, pos)][tag].add(form)
    rc = proc.wait()
    if rc != 0:
        raise RuntimeError(f"gzip -dc {path} failed with exit code {rc}")
    display_forms: dict[tuple[str, str], dict[str, str]] = {}
    for key, tag_map in form_cands.items():
        raw_w, _pos = key
        clean: dict[str, str] = {}
        for tag, vals in tag_map.items():
            if len(vals) == 1:
                only = next(iter(vals))
                if only != raw_w:
                    clean[tag] = only
        if clean:
            display_forms[key] = clean
    t0p(f"kaikki: scanned {n:,} lines, used {used:,} entries, {len(display_forms):,} unambiguous form sets", t0)
    return display_forms


def load_morphynet(base: Baseline, store: Store, t0: float) -> None:
    path = REL_DIR / "morphynet/fra.derivational.v1.tsv"
    if not path.exists():
        print(f"WARNING: {path} missing (run with --download)", flush=True)
        return
    targets = set(base.by_key) | base.atlas_keys
    n = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        cols = line.split("\t")
        if len(cols) < 6:
            continue
        b, d, bp, dp = norm_word(cols[0]), norm_word(cols[1]), cols[2], cols[3]
        if d not in targets and b not in targets:
            continue
        store.edge(b, d, "wikt:morphynet", MORPHY_POS.get(bp), MORPHY_POS.get(dp))
        n += 1
    t0p(f"morphynet: {n:,} edges touching LexDB/Atlas", t0)


def load_crawl(base: Baseline, store: Store, t0: float) -> dict[str, Counter]:
    stats: dict[str, Counter] = defaultdict(Counter)
    if not CRAWL.exists():
        return stats
    latest: dict[tuple[str, str], dict] = {}
    for line in CRAWL.read_text(encoding="utf-8").splitlines():
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        latest[(rec.get("source"), rec.get("query"))] = rec
    for (src, _q), rec in latest.items():
        stats[src][rec.get("status")] += 1
        if rec.get("status") != "ok":
            continue
        q = norm_word(rec.get("final_headword") or rec.get("query"))
        qpos = CNRTL_POS.get(rec.get("pos") or "") if src == "cnrtl" else None
        eids = base.entries_for(q, {qpos} if qpos else None) or base.entries_for(norm_word(rec["query"]), None)
        if src == "frdic":
            eids = eids[:1]
        syn = rec.get("syn") or []
        ranks = rec.get("syn_rank") or []
        for idx, s in enumerate(syn):
            sc = ranks[idx] if idx < len(ranks) else max(0, 100 - 4 * idx)
            if src == "cnrtl" and sc < 10:
                continue  # long tail of weak CRISCO neighbours
            for eid in eids:
                store.add(eid, "syn", norm_word(s), src, sc)
        for a in rec.get("ant") or []:
            for eid in eids:
                store.add(eid, "ant", norm_word(a), src, 50)
        if src == "cnrtl":
            for s, t, directed, cx in rec.get("family_edges") or []:
                sk, tk = norm_word(s), norm_word(t)
                if cx == "motiv-sem":
                    continue  # semantic motivation only (beau -> pancalisme), not a morphological edge
                if directed:
                    store.edge(sk, tk, "cnrtl")
                else:
                    store.relate(sk, tk, "cnrtl", need_stem=True)
            fam = [norm_word(x) for x in rec.get("derived") or []]
            for x in fam:
                store.peer(q, x, "cnrtl", need_stem=True)
        else:
            for x in rec.get("derived") or []:
                store.edge(q, norm_word(x), "frdic")
    t0p(f"crawl: {sum(sum(v.values()) for v in stats.values())} records {dict((k, dict(v)) for k, v in stats.items())}", t0)
    return stats


def load_atlas(base: Baseline, store: Store, t0: float) -> None:
    head = lambda s: norm_word(re.sub(r"\s*\([^)]*\)\s*$", "", s.split("｜")[0]))  # noqa: E731
    for c in base.orig_cards:
        ck = norm_word(c["lemma"])
        eids = [i for i, e in ((i, base.entries[i]) for i in base.by_key.get(ck, [])) if e.get("atlasId") == c["id"]]
        if not eids:
            eids = base.entries_for(ck, {coarse(c.get("pos", ""))})
        for f in c.get("fam") or []:
            fk = head(f)
            if fk and " " not in fk:
                store.relate(ck, fk, "atlas")
        for kind in ("syn", "ant"):
            for s in c.get(kind) or []:
                for eid in eids:
                    store.add(eid, kind, head(s), "atlas", 100)
    fams = base.orig_families
    for g in fams:
        names = [norm_word(g.get("name") or "")]
        for wid in g.get("words") or []:
            c = base.card_by_id.get(wid)
            if c:
                names.append(norm_word(c["lemma"]))
        names += [norm_word(x) for x in g.get("examples") or []]
        names = [x for x in dict.fromkeys(names) if x and " " not in x]
        root = names[0] if names else ""
        for x in names[1:]:
            if share_stem(root, x, 3):  # drops curated-group strays (grand -> TGV, solidarité -> pacs)
                store.relate(root, x, "atlas")
            for y in names[1:]:
                if share_stem(x, y, 4):
                    store.peer(x, y, "atlas:peer")
    t0p(f"atlas: {len(base.cards)} cards, {len(fams)} family groups", t0)


def load_shipped(base: Baseline, store: Store, t0: float) -> None:
    """Shipped lists came from Atlas + fr.wiktionnaire; Atlas items are re-read from lexicon.json, the rest is 'wikt'."""
    for eid, e in base.orig_rel.items():
        if eid not in base.entries:
            continue
        wk = norm_word(base.entries[eid]["w"])
        for x in e.get("derived") or []:
            xk = norm_word(x)
            if " " not in xk:
                store.edge(wk, xk, "wikt:shipped", None, None)
        for kind in ("syn", "ant"):
            for x in e.get(kind) or []:
                store.add(eid, kind, norm_word(x), "wikt:shipped", 40)
    t0p("shipped fr.wiktionnaire relations loaded", t0)


def load_omw(base: Baseline, store: Store, t0: float) -> None:
    fr_xml = REL_DIR / "omw/omw-fr/omw-fr.xml"
    en_xml = REL_DIR / "omw/omw-en/omw-en.xml"
    if not fr_xml.exists() or not en_xml.exists():
        print("WARNING: OMW xml missing (run with --download)", flush=True)
        return
    # French: sense -> (word, pos), synset -> ili, members
    sense_word: dict[str, tuple[str, str]] = {}
    syn_ili: dict[str, str] = {}
    syn_members: dict[str, list[tuple[str, str]]] = defaultdict(list)
    cur_word = cur_pos = None
    for ev, el in ET.iterparse(str(fr_xml), events=("start", "end")):
        tag = el.tag
        if ev == "start" and tag == "Lemma":
            cur_word, cur_pos = norm_word(el.get("writtenForm") or ""), OMW_POS.get(el.get("partOfSpeech") or "")
        elif ev == "end" and tag == "Sense":
            if cur_word and cur_pos:
                syn_members[el.get("synset")].append((cur_word, cur_pos))
            el.clear()
        elif ev == "end" and tag == "Synset":
            syn_ili[el.get("id")] = el.get("ili") or ""
            el.clear()
        elif ev == "end" and tag == "LexicalEntry":
            el.clear()
    ili_fr: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for sid, mem in syn_members.items():
        ili = syn_ili.get(sid)
        if ili:
            ili_fr[ili] = list(dict.fromkeys(mem))
    polysemy: Counter = Counter()
    for mem in ili_fr.values():
        for w, p in mem:
            polysemy[(w, p)] += 1
    n_syn = 0
    for mem in ili_fr.values():
        known = [(w, p) for w, p in mem if base.known(w)]
        if len(known) < 2 or len(mem) > 12:
            continue
        for w, p in known:
            # score 10 = may stand alone (tiny synset, low polysemy); 5 = corroboration only
            solo = len(mem) <= 3 and polysemy[(w, p)] <= 8
            for eid in base.entries_for(w, {p}):
                for w2, p2 in known:
                    if w2 != w and p2 == p and p in base.target_pos(w2):
                        store.add(eid, "syn", w2, "omw", 10 if solo and polysemy[(w2, p2)] <= 8 else 5)
                        n_syn += 1
    # English antonyms (sense level) -> synset pairs -> ILI pairs -> French words
    en_sense_synset: dict[str, str] = {}
    ant_pairs: list[tuple[str, str]] = []
    en_syn_ili: dict[str, str] = {}
    cur_sense = None
    for ev, el in ET.iterparse(str(en_xml), events=("start", "end")):
        tag = el.tag
        if ev == "start" and tag == "Sense":
            cur_sense = (el.get("id"), el.get("synset"))
            en_sense_synset[cur_sense[0]] = cur_sense[1]
        elif ev == "start" and tag == "SenseRelation" and el.get("relType") == "antonym" and cur_sense:
            ant_pairs.append((cur_sense[1], el.get("target")))
        elif ev == "end" and tag == "Synset":
            en_syn_ili[el.get("id")] = el.get("ili") or ""
            el.clear()
        elif ev == "end" and tag in ("LexicalEntry", "Sense"):
            if tag == "LexicalEntry":
                el.clear()
    n_ant = 0
    for s1, tsense in ant_pairs:
        s2 = en_sense_synset.get(tsense)
        a, b = ili_fr.get(en_syn_ili.get(s1, "")), ili_fr.get(en_syn_ili.get(s2 or "", ""))
        if not a or not b or len(a) > 6 or len(b) > 6:
            continue
        for w, p in a:
            if not base.known(w):
                continue
            for w2, p2 in b:
                if w2 != w and p2 == p and base.known(w2) and p in base.target_pos(w2):
                    for eid in base.entries_for(w, {p}):
                        store.add(eid, "ant", w2, "omw", 10)
                        n_ant += 1
    t0p(f"omw: {len(ili_fr):,} fr synsets, {n_syn:,} syn links, {len(ant_pairs):,} en antonym pairs -> {n_ant:,} fr ant links", t0)


# ------------------------------------------------------------------------------------------- resolution
def caps_for(e: dict) -> tuple[int, int, int]:
    rank = e.get("rank") or 999999
    if e.get("atlasId") or e.get("level") == "B2" or rank <= 15000:
        return 10, 8, 6
    return 6, 5, 4


def is_inflection(base: Baseline, eid: str, tkey: str) -> bool:
    """True when tkey is an inflected form of eid (or vice versa) and not a distinct lemma of another POS."""
    tf = lexdb_fold(tkey)
    wf = lexdb_fold(base.entries[eid]["w"])
    linked = tf in base.infl_of.get(eid, set())
    if not linked:
        for oid in base.by_key.get(tkey, []):
            if wf in base.infl_of.get(oid, set()):
                linked = True
                break
    if not linked:
        return False
    tpos = base.target_pos(tkey)
    return not (tpos and not (tpos & base.pos_of[eid]) and tpos & {"n", "adv"})


def resolve_entry(base: Baseline, store: Store, eid: str) -> dict[str, list[tuple[str, tuple]]]:
    e = base.entries[eid]
    wk = norm_word(e["w"])
    wf = lexdb_fold(e["w"])
    P = base.pos_of[eid]
    out: dict[str, list[tuple[str, tuple]]] = {}

    def ok_target(tk: str) -> bool:
        if not tk or tk == wk or lexdb_fold(tk) == wf or is_affix(tk) or not base.known(tk):
            return False
        return True

    # ---- derived (morphological family)
    cands: dict[str, dict] = {}

    def put(tk: str, lin: set[str], direct: int):
        if not ok_target(tk) or " " in tk or (wk, tk) in BAD_DERIVED_PAIRS:
            return
        if len(lexdb_fold(tk)) <= 2 and "atlas" not in lin:
            return
        c = cands.setdefault(tk, {"lin": set(), "direct": 9})
        c["lin"] |= lin
        c["direct"] = min(c["direct"], direct)

    def pos_ok(edge_pos: set[str]) -> bool:
        return not edge_pos or bool(edge_pos & P) or bool(P & {"loc", "?"})

    parents = []
    for b, ders in ((b, store.edges[b]) for b in list(store.edges_rev.get(wk, ()))):
        ed = ders.get(wk)
        if ed and pos_ok(ed["dpos"]) and (wk, b) not in BAD_DERIVED_PAIRS:
            if len(lexdb_fold(b)) > 2:
                parents.append(b)
            put(b, ed["lin"], 0)
    children = []
    for d, ed in store.edges.get(wk, {}).items():
        if pos_ok(ed["bpos"]) and (wk, d) not in BAD_DERIVED_PAIRS:
            if len(lexdb_fold(d)) > 2:
                children.append(d)
            put(d, ed["lin"], 0)
    for r, lin in store.related.get(wk, {}).items():
        put(r, lin, 0)
    if len(lexdb_fold(wk)) > 2:
        for d in children:
            if len(lexdb_fold(d)) <= 2:
                continue
            for d2, ed2 in store.edges.get(d, {}).items():
                put(d2, ed2["lin"], 1)
        # compounds / prefixed words (bonheur = bon + heur, malheureux = mal + heureux): only the head (final)
        # component spawns siblings, so bonheur joins the heur family but not bonté / bonjour
        heads = [b for b in parents if wf.endswith(lexdb_fold(b))] if len(parents) > 1 else parents
        for b in heads or parents:
            if len(lexdb_fold(b)) <= 2 or len(store.edges.get(b, {})) > 60:
                continue
            for s, eds in store.edges.get(b, {}).items():
                put(s, eds["lin"], 1)
        for r in list(store.related.get(wk, {}))[:20]:
            if len(lexdb_fold(r)) <= 2 or (r in parents and r not in (heads or parents)):
                continue
            for d, ed in store.edges.get(r, {}).items():
                put(d, ed["lin"], 1)
    for p, lin in store.family_peers.get(wk, {}).items():
        put(p, lin, 1)
    for tk in list(cands):
        if is_inflection(base, eid, tk):
            del cands[tk]
    out["derived"] = rank_cands(base, cands)

    # ---- syn / ant
    for kind in ("syn", "ant"):
        cc: dict[str, dict] = {}
        for tk, c in store.rel.get(eid, {}).get(kind, {}).items():
            if not ok_target(tk):
                continue
            if kind == "ant" and (wk, tk) in BAD_ANT_PAIRS:
                continue
            if kind == "syn" and re.search(r"(^|[\s'’-])" + re.escape(wk) + r"($|[\s-])", tk):
                continue  # compounds containing the headword (page d'accueil) are not synonyms (non-violence IS an antonym)
            tpos = base.target_pos(tk)
            if tpos and not (tpos & P) and not (P & {"loc", "?"}):
                continue
            if is_inflection(base, eid, tk):
                continue
            lin = set(c["lin"])
            top = lineages(lin)
            if top == {"cnrtl"} and kind == "syn" and c["cs"] < 15:
                continue  # weak CRISCO tail without corroboration
            if top == {"omw"} and (kind == "ant" or c.get("omw", 0) < 10):
                continue  # WOLF-only antonym projections / polysemous or large synsets are too noisy alone
            cc[tk] = {"lin": lin, "direct": 0, "score": c["score"], "att": attestation(lin, c["cs"] if kind == "syn" else -1)}
        out[kind] = rank_cands(base, cc)
    # syn and ant disjoint: keep a word where it is better attested (ties -> syn)
    syn_d = dict(out["syn"])
    ant_d = dict(out["ant"])
    for tk in set(syn_d) & set(ant_d):
        if ant_d[tk][0] < syn_d[tk][0]:  # rank key starts with -lineages
            out["syn"] = [x for x in out["syn"] if x[0] != tk]
        else:
            out["ant"] = [x for x in out["ant"] if x[0] != tk]
    return out


def lineages(lin: set[str]) -> set[str]:
    """MorphyNet + en.wiktionary (Kaikki) + shipped fr.wiktionnaire count as ONE Wiktionary lineage."""
    return {x.split(":")[0] for x in lin}


def attestation(lin: set[str], cnrtl_score: int = -1) -> float:
    """Weighted lineage count: wikt/cnrtl/frdic/atlas = 1, OMW (WOLF) = 0.5; a weak CRISCO synonym (<20) = 0.5 and a
    strong one earns up to +0.4, so CRISCO's own ranking orders single-lineage synonyms."""
    att = 0.0
    for x in lineages(lin):
        if x == "omw" or (x == "atlas" and "atlas" not in lin):  # WOLF, or Atlas group co-membership only
            att += 0.5
        elif x == "cnrtl" and 0 <= cnrtl_score < 20:
            att += 0.5
        else:
            att += 1.0
    if cnrtl_score >= 20 and "cnrtl" in lineages(lin):
        att += 0.4 * min(cnrtl_score, 100) / 100
    return round(att, 3)


def rank_cands(base: Baseline, cands: dict[str, dict]) -> list[tuple[str, tuple]]:
    rows = []
    for tk, c in cands.items():
        lin = c["lin"]
        key = (
            -c.get("att", attestation(lin)),
            c.get("direct", 0),
            0 if tk in base.atlas_keys or tk in base.atlas_linked_keys else 1,
            base.target_rank(tk),
            -c.get("score", 0),
            tk,
        )
        rows.append((tk, key, sorted(lin)))
    rows.sort(key=lambda r: r[1])
    return [(tk, (k, lin)) for tk, k, lin in rows]


# ------------------------------------------------------------------------------------------- stats
def coverage(entries: dict[str, dict], base: Baseline) -> dict:
    pops = {
        "all": [e for e in entries.values()],
        "atlas_linked": [e for e in entries.values() if e.get("atlasId")],
        "b2": [e for e in entries.values() if e.get("level") == "B2"],
    }
    out = {}
    for name, rows in pops.items():
        n = len(rows)
        d = {"n": n}
        for k in ("derived", "syn", "ant"):
            c = sum(1 for e in rows if e.get(k))
            d[k] = c
            d[f"{k}_pct"] = round(100 * c / n, 2) if n else 0.0
            items = [x for e in rows for x in e.get(k) or []]
            d[f"{k}_items"] = len(items)
            d[f"{k}_resolved_pct"] = round(100 * sum(1 for x in items if base.known(norm_word(x))) / len(items), 2) if items else 0.0
            if k == "derived":
                d["derived_multiword_pct"] = round(100 * sum(1 for x in items if " " in x) / len(items), 2) if items else 0.0
        out[name] = d
    allitems = [x for e in entries.values() for k in ("derived", "syn", "ant") for x in e.get(k) or []]
    out["resolution_pct_all_relations"] = round(100 * sum(1 for x in allitems if base.known(norm_word(x))) / len(allitems), 2) if allitems else 0.0
    return out


def card_coverage(cards: list[dict]) -> dict:
    n = len(cards)
    return {"n": n, **{k: sum(1 for c in cards if c.get(k)) for k in ("fam", "syn", "ant")},
            **{f"{k}_items": sum(len(c.get(k) or []) for c in cards) for k in ("fam", "syn", "ant")}}


# ------------------------------------------------------------------------------------------- export
def shard_and_write(entries: dict[str, dict], forms_map: dict[str, list[str]], dry: bool) -> list[str]:
    splits_set: set[str] = set()
    for target_len in (2, 3):
        e_cur: dict[str, dict] = defaultdict(dict)
        for lid, entry in entries.items():
            e_cur[lexdb_key(lexdb_fold(lid), splits_set)][lid] = entry
        f_cur: dict[str, dict] = defaultdict(dict)
        for ff, targets in forms_map.items():
            f_cur[lexdb_key(ff, splits_set)][ff] = targets
        added = False
        for k in sorted(set(e_cur) | set(f_cur)):
            if k == "__" or len(k) != target_len or "_" in k:
                continue
            if len(compact_json_bytes(e_cur.get(k, {}))) > MAX_SHARD_BYTES or len(compact_json_bytes(f_cur.get(k, {}))) > MAX_SHARD_BYTES:
                splits_set.add(k)
                added = True
        if not added:
            break
    e_sh: dict[str, dict] = defaultdict(dict)
    for lid, entry in entries.items():
        e_sh[lexdb_key(lexdb_fold(lid), splits_set)][lid] = entry
    f_sh: dict[str, dict] = defaultdict(dict)
    for ff, targets in forms_map.items():
        f_sh[lexdb_key(ff, splits_set)][ff] = targets
    if not dry:
        for sub, shards in (("e", e_sh), ("forms", f_sh)):
            d = OUT / sub
            tmp_d = OUT / f".{sub}.tmp"
            old_d = OUT / f".{sub}.old"
            shutil.rmtree(tmp_d, ignore_errors=True)
            shutil.rmtree(old_d, ignore_errors=True)
            tmp_d.mkdir(parents=True)
            for k in sorted(shards):
                (tmp_d / f"{k}.json").write_bytes(compact_json_bytes(shards[k]))
            if d.exists():
                d.rename(old_d)
            tmp_d.rename(d)
            shutil.rmtree(old_d, ignore_errors=True)
    return sorted(splits_set)


def build_hints(base: Baseline, entries: dict[str, dict], families: list[dict]) -> dict[str, dict[str, list[str]]]:
    extra: list[str] = []
    for g in families:
        extra.append(g.get("name") or "")
        extra += g.get("examples") or []
        extra += [base.card_by_id[w]["lemma"] for w in g.get("words") or [] if w in base.card_by_id]
    return build_hint_shards(entries, extra, base.cards)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true", help="download/extract raw sources into references/lexdb/relations/")
    ap.add_argument("--dry-run", action="store_true", help="compute + report, write nothing")
    ap.add_argument("--require-baseline", action="store_true", help="fail if git baseline commit is unreachable")
    ap.add_argument("--report-out", default="", help="also write the report JSON here (useful with --dry-run)")
    args = ap.parse_args()
    t0 = time.time()
    if args.download or not (REL_DIR / "omw/omw-fr/omw-fr.xml").exists():
        download()

    base = Baseline(t0, require_baseline=args.require_baseline)
    before_entries = {
        eid: dict(base.orig_rel.get(eid, {})) | {"atlasId": e.get("atlasId"), "level": e.get("level"), "w": e["w"]}
        for eid, e in base.entries.items()
    }
    before_cov = coverage(before_entries, base)
    before_cards = card_coverage(base.orig_cards)
    baseline_fingerprint = fingerprint(base.entries)

    store = Store()
    display_forms = load_kaikki(base, store, t0)
    load_morphynet(base, store, t0)
    crawl_stats = load_crawl(base, store, t0)
    load_atlas(base, store, t0)
    load_shipped(base, store, t0)
    load_omw(base, store, t0)
    for b, ders in store.edges.items():
        for d in ders:
            store.edges_rev[d].add(b)
    t0p(f"graph: {sum(len(v) for v in store.edges.values()):,} derivation edges, {sum(len(v) for v in store.related.values()) // 2:,} related pairs", t0)

    # resolve every entry
    resolved: dict[str, dict] = {}
    lineage_counter: Counter = Counter()
    for eid, e in base.entries.items():
        r = resolve_entry(base, store, eid)
        cd, cs, ca = caps_for(e)
        res = {}
        for kind, cap in (("derived", cd), ("syn", cs), ("ant", ca)):
            rows = r[kind][:cap]
            res[kind] = rows
            for _, (_k, lin) in rows:
                for x in lin:
                    lineage_counter[(kind, x)] += 1
        resolved[eid] = res
        for kind in ("derived", "syn", "ant"):
            vals = [base.canon(tk) for tk, _ in res[kind]]
            vals = list(dict.fromkeys(vals))
            if vals:
                e[kind] = vals
            else:
                e.pop(kind, None)
        # fill missing display forms (nouns / adjectives) from unambiguous exact-case Wiktionary entries
        if "forms" not in e:
            exact_w = nfc(e["w"]).strip()
            for pb in e.get("pos") or []:
                cp = coarse(pb.get("p", ""))
                df = display_forms.get((exact_w, cp))
                if df and cp in ("n", "adj"):
                    fo = {k: df[k] for k in ("f", "pl", "fpl") if k in df and df[k] != exact_w}
                    if fo:
                        e["forms"] = fo
                        for v in fo.values():
                            ff = lexdb_fold(v)
                            if ff != lexdb_fold(e["w"]) and len(ff) <= 60:
                                tl = base.forms_map.setdefault(ff, [])
                                if eid not in tl and len(tl) < 5:
                                    tl.append(eid)
                    break
        # keep key order stable: relations sit after phrases, before family/frDefs
        order = ["id", "w", "ipa", "level", "rank", "atlasId", "forms", "pos", "phrases", "syn", "ant", "derived", "family",
                 "frDefs", "etym", "conj", "confusable", "sources"]
        new = {k: e[k] for k in order if k in e}
        for k in e:
            if k not in new:
                new[k] = e[k]
        base.entries[eid] = new
    t0p("resolved relations for all entries", t0)

    # sources: add lineages that now feed relations
    for eid, res in resolved.items():
        e = base.entries[eid]
        srcs = set(e.get("sources") or [])
        lins = {x for kind in res for _, (_k, lin) in res[kind] for x in lin}
        for lab, src in (("cnrtl", "cnrtl"), ("frdic", "frdic"), ("omw", "omw"), ("atlas", "atlas"),
                         ("wikt:morphynet", "morphynet"), ("wikt:kaikki", "wikt-fr"), ("wikt:shipped", "wikt-fr")):
            if lab in lins:
                srcs.add(src)
        e["sources"] = sorted(srcs)

    after_cov = coverage(base.entries, base)
    fp_after = fingerprint(base.entries)
    assert fp_after == baseline_fingerprint, "baseline fields changed!"

    # ---- propagate to Atlas
    propagate_atlas(base, resolved)
    # report the net change against the pre-enrichment cards (stable across reruns)
    orig_by_id = {c["id"]: c for c in base.orig_cards}
    atlas_changes: Counter = Counter()
    for c in base.cards:
        o = orig_by_id.get(c["id"], {})
        for field in ("fam", "syn", "ant"):
            added = len(c.get(field) or []) - len(o.get(field) or [])
            if added > 0:
                atlas_changes[f"{field}_cards"] += 1
                atlas_changes[f"{field}_items"] += added
    atlas_changes = dict(atlas_changes)
    after_cards = card_coverage(base.cards)

    if not args.dry_run:
        LEXICON.write_text(json.dumps(base.lexicon, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        # rebuild families.json from the enriched LexDB + Atlas, requiring direct edges or multi-lineage attestation
        strong_derived: dict[str, list[str]] = {}
        for eid, res in resolved.items():
            s_vals: list[str] = []
            for tk, (key, lin) in res.get("derived", []):
                if is_strong_derived(key, lin):
                    w = base.canon(tk)
                    if w not in s_vals:
                        s_vals.append(w)
            if s_vals:
                strong_derived[eid] = s_vals
        spec = importlib.util.spec_from_file_location("build_families", ROOT / "scripts/build-families.py")
        bf = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(bf)
        bf.build(base.entries, [dict(g) for g in base.orig_families], strong_derived)
    families = json.loads(FAMILIES.read_text(encoding="utf-8"))
    fam_by_card = {}
    for g in families:
        for wid in g.get("words") or []:
            fam_by_card.setdefault(wid, g["id"])
    for e in base.entries.values():
        if "family" not in e and e.get("atlasId") in fam_by_card:
            e["family"] = fam_by_card[e["atlasId"]]

    # ---- write shards, hints, meta
    splits = shard_and_write(base.entries, base.forms_map, args.dry_run)
    hints = build_hints(base, base.entries, families)
    if not args.dry_run:
        write_hint_shards(OUT, hints)
        write_meta(base, splits)
    t0p(f"wrote shards (splits={len(splits)}), hints={sum(len(v) for v in hints.values())} words in {len(hints)} buckets", t0)

    report = build_report(base, before_cov, after_cov, before_cards, after_cards, crawl_stats, lineage_counter, atlas_changes, resolved, hints)
    if REPORT.exists():  # keep the manual stratified quality evaluation across reruns
        prev = json.loads(REPORT.read_text(encoding="utf-8"))
        if "quality_eval" in prev:
            report["quality_eval"] = prev["quality_eval"]
    if not args.dry_run:
        REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.report_out:
        Path(args.report_out).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"before": before_cov, "after": after_cov, "cards_before": before_cards, "cards_after": after_cards}, ensure_ascii=False, indent=1))
    t0p("done", t0)


def fingerprint(entries: dict[str, dict]) -> str:
    import hashlib

    h = hashlib.sha256()
    for eid in sorted(entries):
        e = entries[eid]
        frozen = {k: e.get(k) for k in ("id", "w", "ipa", "level", "rank", "atlasId", "pos", "phrases", "frDefs", "etym", "conj", "confusable")}
        h.update(json.dumps(frozen, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    return h.hexdigest()


def write_meta(base: Baseline, splits: list[str]) -> None:
    meta = base.meta
    sources = dict(meta.get("sources") or {})
    for k, v in SOURCE_DESCRIPTIONS.items():
        sources.setdefault(k, v)
        if k in ("morphynet", "cnrtl", "frdic"):
            sources[k] = v
    meta["sources"] = sources
    meta["licenses"] = list(dict.fromkeys((meta.get("licenses") or []) + SOURCE_LICENSES))
    meta["generated"] = date.today().isoformat()
    meta["splits"] = splits
    meta["hintsShards"] = True
    counts = meta.setdefault("counts", {})
    ents = base.entries.values()
    counts["lemmas"] = len(base.entries)
    counts["withZh"] = sum(1 for e in ents if any(s.get("zh") for pb in e.get("pos") or [] for s in pb.get("senses") or []))
    counts["phrases"] = sum(len(e.get("phrases") or []) for e in ents)
    conf = {"0": 0, "1": 0, "2": 0, "3": 0}
    for e in ents:
        for pb in e.get("pos") or []:
            for s in pb.get("senses") or []:
                conf[str(s.get("conf", 1))] += 1
    counts["conf"] = conf
    counts["withDerived"] = sum(1 for e in ents if e.get("derived"))
    counts["withSyn"] = sum(1 for e in ents if e.get("syn"))
    counts["withAnt"] = sum(1 for e in ents if e.get("ant"))
    ordered = {}
    for k in ("version", "generated", "sources", "licenses", "splits", "suggestShards", "suggestSplits", "hintsShards", "counts"):
        if k in meta:
            ordered[k] = meta[k]
    for k in meta:
        ordered.setdefault(k, meta[k])
    (OUT / "meta.json").write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


# ------------------------------------------------------------------------------------------- Atlas
def is_strong_derived(key: tuple, lin: list[str] | set[str]) -> bool:
    """Direct morphological edge from a trusted lexical source, or indirect 2-hop edge attested by >=2 lineages / Atlas."""
    top = lineages(set(lin))
    return len(top) >= 2 or "atlas" in top or (key[1] == 0 and bool(top & {"wikt", "cnrtl", "frdic"}))


def propagate_atlas(base: Baseline, resolved: dict[str, dict]) -> dict:
    head = lambda s: norm_word(re.sub(r"\s*\([^)]*\)\s*$", "", s.split("｜")[0]))  # noqa: E731
    orig_by_id = {c["id"]: c for c in base.orig_cards}
    linked: dict[str, str] = {}
    for eid, e in base.entries.items():
        if e.get("atlasId"):
            linked.setdefault(e["atlasId"], eid)
    changes = Counter()
    for c in base.cards:
        orig_c = orig_by_id.get(c["id"], {})
        eid = linked.get(c["id"])
        if not eid:
            cand = base.entries_for(norm_word(c["lemma"]), {coarse(c.get("pos", ""))})
            eid = cand[0] if cand else None
        if not eid:
            changes["unmatched"] += 1
            continue
        res = resolved.get(eid) or {}
        self_k = norm_word(c["lemma"])
        for field, kind, cap in (("fam", "derived", 8), ("syn", "syn", 6), ("ant", "ant", 6)):
            cur = list(orig_c.get(field) or [])
            have = {head(x) for x in cur} | {self_k}
            added = 0
            for tk, (key, lin) in res.get(kind, []):
                if len(cur) >= cap:
                    break
                if tk in have:
                    continue
                top = lineages(set(lin))
                if kind == "derived":
                    strong = is_strong_derived(key, lin)
                else:
                    strong = len(top) >= 2 or "atlas" in top or ("cnrtl" in top and key[4] <= -40)
                if not strong:
                    continue
                word = base.canon(tk)
                if len(word) > 80:
                    continue
                zh = hint_zh_for(base, tk)
                if field == "fam":
                    cur.append(f"{word}｜{zh[:38]}" if zh else word)
                else:
                    tp = ""
                    ids = base.by_key.get(tk)
                    if ids:
                        tp = base.entries[ids[0]]["pos"][0].get("p", "")
                    elif base.atlas_by_key.get(tk):
                        tp = base.atlas_by_key[tk][0].get("pos", "")
                    cur.append(f"{word} ({tp})" if tp else word)
                have.add(tk)
                added += 1
            if cur or field in orig_c:
                c[field] = cur
            else:
                c.pop(field, None)
            if added:
                changes[f"{field}_cards"] += 1
                changes[f"{field}_items"] += added
    return dict(changes)


def hint_zh_for(base: Baseline, tk: str) -> str:
    for eid in base.by_key.get(tk, []):
        for pb in base.entries[eid].get("pos") or []:
            for s in pb.get("senses") or []:
                if s.get("zh"):
                    return short_hint_zh(s["zh"])
    for c in base.atlas_by_key.get(tk, []):
        z = next((s.get("zh") for s in c.get("senses") or [] if s.get("zh")), "")
        if z:
            return short_hint_zh(z)
    return ""


# ------------------------------------------------------------------------------------------- report
SPOT = ["heureux", "bonheur", "accueil", "beau", "prendre", "triste", "grand", "tache", "tâche", "se rendre", "s'agir"]


def build_report(base, before_cov, after_cov, before_cards, after_cards, crawl_stats, lineage_counter, atlas_changes, resolved, hints) -> dict:
    spot = {}
    for w in SPOT:
        for eid in base.by_key.get(norm_word(w), [])[:2]:
            e = base.entries[eid]
            spot[eid] = {
                "w": e["w"],
                "derived": [{"w": base.canon(tk), "lineages": lin, "direct": k[1] == 0} for tk, (k, lin) in resolved[eid]["derived"]],
                "syn": [{"w": base.canon(tk), "lineages": lin} for tk, (k, lin) in resolved[eid]["syn"]],
                "ant": [{"w": base.canon(tk), "lineages": lin} for tk, (k, lin) in resolved[eid]["ant"]],
            }
    sizes = sorted(((p.stat().st_size, str(p.relative_to(OUT))) for p in OUT.rglob("*.json")), reverse=True)
    return {
        "generated": date.today().isoformat(),
        "method": "scripts/lexdb/enrich-relations.py over the shipped public/lexdb baseline (ids, senses, examples, phrases, frDefs, zh/, suggest/ unchanged)",
        "coverage_before": before_cov,
        "coverage_after": after_cov,
        "atlas_cards_before": before_cards,
        "atlas_cards_after": after_cards,
        "atlas_propagation": atlas_changes,
        "crawl_status": {k: dict(v) for k, v in crawl_stats.items()},
        "lineage_contributions": {f"{k}:{x}": n for (k, x), n in sorted(lineage_counter.items())},
        "hints_words": sum(len(v) for v in hints.values()),
        "size": {
            "public_lexdb_bytes": sum(s for s, _ in sizes),
            "public_lexdb_mib": round(sum(s for s, _ in sizes) / 1048576, 2),
            "max_shard": {"path": sizes[0][1], "bytes": sizes[0][0]} if sizes else None,
            "max_hints_shard_bytes": max((s for s, p in sizes if p.startswith("hints/")), default=0),
        },
        "spot_check": spot,
    }


if __name__ == "__main__":
    main()
