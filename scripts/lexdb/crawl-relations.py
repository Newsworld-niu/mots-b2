#!/usr/bin/env python3
"""Resumable, rate-limited crawler for French lexical relations (CNRTL CRISCO DES + Frdic).

Writes one normalized JSON object per (source, query) to data/lexdb/crawled-relations.jsonl:

  {"source": "cnrtl"|"frdic", "query": w, "final_headword": hw, "status": "ok"|"empty"|"miss"|"login_wall"|"throttled"|"error",
   "retrieved_at": iso, "parser_version": 1, "pos": "...", "syn": [...], "ant": [...], "derived": [...], "forms": {...},
   ...source-specific extras ("syn_rank", "base", "family_edges")}

Only relation word lists are stored (no definitions/examples), so the committed JSONL stays a factual index.

Sources:
  cnrtl  https://www.cnrtl.fr/synonymie/<w>[/<pos>]  (one request: the page embeds window.__PINIA__ with ranked
         CRISCO synonyms, antonyms, the ATILF morphological family graph and inflected forms)
  frdic  https://www.frdic.com/dicts/fr/<w>  (curl subprocess: Python's default TLS fails on frdic from this VM;
         <h5> headings may contain <img> glyphs: 近<img>词 -> syn, 反<img>词 -> ant, 派生/同根/衍生 -> derived,
         副词变化 -> derived, 形容词变化/名词变化 -> forms (名词变化 of a verb -> derived), 联想词 excluded)

Usage:
  python3 scripts/lexdb/crawl-relations.py --source cnrtl --tier b2 --limit 600 --delay 0.25 --concurrency 2
  python3 scripts/lexdb/crawl-relations.py --source frdic --words heureux,bonheur,accueil --delay 2
  python3 scripts/lexdb/crawl-relations.py --source both --tier atlas --limit 100
"""
from __future__ import annotations

import argparse
import html as htmlmod
import json
import random
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, lexdb_fold, load_lexdb_entries, nfc  # noqa: E402

PARSER_VERSION = 1
DEFAULT_OUT = ROOT / "data/lexdb/crawled-relations.jsonl"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 mots-b2-lexdb/1.0"
DONE_STATUSES = {"ok", "empty", "miss"}
CNRTL_POS = {"n.": "nom", "n.m.": "nom", "n.f.": "nom", "n.m./f.": "nom", "adj.": "adjectif", "v.": "verbe", "adv.": "adverbe"}
PINIA_RE = re.compile(r"window\.__PINIA__=(\{.*?\})</script>", re.S)


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


class StopSource(Exception):
    pass


class Writer:
    """Append-only JSONL writer that repairs a partial trailing line before resuming."""

    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.Lock()
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists() and path.stat().st_size:
            raw = path.read_bytes()
            if not raw.endswith(b"\n"):
                cut = raw.rfind(b"\n") + 1
                path.write_bytes(raw[:cut])
                print(f"[crawl] truncated partial trailing line ({len(raw) - cut} bytes)", flush=True)

    def load_done(self) -> dict[tuple[str, str], dict]:
        done: dict[tuple[str, str], dict] = {}
        if not self.path.exists():
            return done
        for line in self.path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            done[(rec.get("source"), rec.get("query"))] = rec
        return done

    def append(self, rec: dict) -> None:
        line = json.dumps(rec, ensure_ascii=False, separators=(",", ":")) + "\n"
        with self.lock:
            with self.path.open("a", encoding="utf-8") as fh:
                fh.write(line)
                fh.flush()


class Pacer:
    """Per-source politeness: each worker waits delay +/- 40% jitter between requests; shared backoff on throttling."""

    def __init__(self, delay: float):
        self.delay = delay
        self.lock = threading.Lock()
        self.not_before = 0.0
        self.throttles = 0
        self.login_walls = 0  # consecutive; frdic redirects unknown words to /Account/Login too

    def wait(self) -> None:
        with self.lock:
            nb = self.not_before
        now = time.time()
        if nb > now:
            time.sleep(nb - now)
        time.sleep(max(0.0, self.delay * random.uniform(0.6, 1.4)))

    def backoff(self, seconds: float) -> None:
        with self.lock:
            self.throttles += 1
            self.not_before = max(self.not_before, time.time() + seconds)


def base_record(source: str, query: str) -> dict:
    return {
        "source": source,
        "query": query,
        "final_headword": None,
        "status": "error",
        "retrieved_at": now_iso(),
        "parser_version": PARSER_VERSION,
        "syn": [],
        "ant": [],
        "derived": [],
        "forms": {},
    }


def uniq(seq):
    out = []
    for x in seq:
        x = nfc(x).strip()
        if x and x not in out:
            out.append(x)
    return out


# ---------------------------------------------------------------- CNRTL
def http_get(url: str, timeout: float = 25.0) -> tuple[int, str, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html", "Accept-Language": "fr"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace"), dict(r.headers)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace") if e.fp else ""
        return e.code, body, dict(e.headers or {})


def parse_cnrtl(query: str, page: str) -> dict:
    rec = base_record("cnrtl", query)
    m = PINIA_RE.search(page)
    if not m:
        rec["status"] = "error"
        rec["error"] = "no __PINIA__ payload"
        return rec
    data = json.loads(m.group(1))
    responses = (data.get("payload") or {}).get("responses") or {}
    resp = next(iter(responses.values()), None) if responses else None
    header = (resp or {}).get("header")
    if not resp or not header:
        rec["status"] = "miss"
        return rec
    rec["final_headword"] = nfc(header.get("form") or query)
    rec["pos"] = header.get("pos") or ""
    syn_rank: list[int] = []
    syn: list[str] = []
    ant: list[str] = []
    family_nodes: dict[str, str] = {}
    edges: list[list] = []
    forms: dict[str, list[str]] = {}
    for block in resp.get("content") or []:
        cid = block.get("id")
        content = block.get("content")
        if cid == "synonyms" and isinstance(content, list):
            for it in content:
                v = nfc(str(it.get("value") or "")).strip()
                if v and v not in syn:
                    syn.append(v)
                    syn_rank.append(int(it.get("rank") or 0))
        elif cid == "antonyms" and isinstance(content, list):
            ant = uniq(str(it.get("value") or "") for it in content)
        elif cid == "families" and isinstance(content, dict):
            for n in content.get("nodes") or []:
                family_nodes[n.get("id")] = nfc(str(n.get("label") or "")).strip()
            for ln in content.get("links") or []:
                s, t = family_nodes.get(ln.get("source")), family_nodes.get(ln.get("target"))
                if s and t:
                    edges.append([s, t, str(ln.get("directed") or "0") == "1", ln.get("complexite") or ""])
        elif cid == "conjugate" and isinstance(content, list):
            for it in content:
                f = nfc(str(it.get("form") or "")).strip()
                if not f or f == rec["final_headword"]:
                    continue
                tag = ("f" if it.get("genre") == "féminin" else "m") + ("pl" if it.get("number") == "pluriel" else "")
                forms.setdefault(tag, [])
                if f not in forms[tag]:
                    forms[tag].append(f)
    hw = rec["final_headword"]
    rec["syn"] = syn
    rec["syn_rank"] = syn_rank
    rec["ant"] = ant
    rec["derived"] = uniq(v for v in family_nodes.values() if v != hw)
    rec["base"] = uniq(s for s, t, directed, _ in edges if t == hw and directed)
    rec["family_edges"] = edges
    rec["forms"] = forms
    rec["status"] = "ok" if (syn or ant or rec["derived"]) else "empty"
    return rec


def crawl_cnrtl(query: str, pos_hint: str, pacer: Pacer) -> dict:
    q = urllib.parse.quote(query, safe="")
    urls = []
    if CNRTL_POS.get(pos_hint):
        urls.append(f"https://www.cnrtl.fr/synonymie/{q}/{CNRTL_POS[pos_hint]}")
    urls.append(f"https://www.cnrtl.fr/synonymie/{q}")
    last = base_record("cnrtl", query)
    for url in urls:
        for attempt in range(4):
            pacer.wait()
            try:
                code, body, headers = http_get(url)
            except Exception as e:  # network error: retry with backoff
                last = base_record("cnrtl", query)
                last["error"] = f"{type(e).__name__}: {e}"[:200]
                time.sleep(2 * (attempt + 1))
                continue
            if code in (429, 503):
                ra = headers.get("Retry-After") or headers.get("retry-after") or "30"
                try:
                    wait_s = float(ra)
                except ValueError:
                    wait_s = 30.0
                pacer.backoff(min(max(wait_s, 5.0), 300.0))
                last = base_record("cnrtl", query)
                last["status"] = "throttled"
                if pacer.throttles >= 8:
                    raise StopSource("cnrtl throttled repeatedly")
                continue
            if code == 404:
                last = base_record("cnrtl", query)
                last["status"] = "miss"
                break  # try the POS-less URL next
            if code != 200:
                last = base_record("cnrtl", query)
                last["error"] = f"HTTP {code}"
                time.sleep(2 * (attempt + 1))
                continue
            rec = parse_cnrtl(query, body)
            rec["url"] = url
            if rec["status"] in ("ok", "empty"):
                return rec
            last = rec
            break
    return last


# ---------------------------------------------------------------- Frdic
H5_RE = re.compile(r"<h5[^>]*>(.*?)</h5>", re.S)
TAG_RE = re.compile(r"<[^>]+>")
SECTION_END_RE = re.compile(r"<h5|<p[\s>]|</div>|<br|</ul>|<div", re.I)
ANCHOR_RE = re.compile(r"<a [^>]*>(.*?)</a>", re.S)


def frdic_heading_kind(raw_heading: str) -> str | None:
    t = TAG_RE.sub("", raw_heading).replace("：", "").replace(":", "").strip()
    if not t or "纠错" in t:
        return None
    if re.search(r"联想|同音|近音|助记|词根|法$", t):
        return None
    if re.search(r"派生|同根|衍生", t):
        return "derived"
    if "副词变化" in t:
        return "adv"
    if "名词变化" in t:
        return "noun"
    if "容词变化" in t:
        return "adj"
    if re.search(r"反.*词", t):
        return "ant"
    if re.search(r"近.*词", t):
        return "syn"
    return None


def frdic_items(section_html: str) -> list[str]:
    if "<li" in section_html:
        out = []
        for li in re.findall(r"<li[^>]*>(.*?)</li>", section_html, re.S):
            a = ANCHOR_RE.search(li)
            txt = TAG_RE.sub("", a.group(1) if a else li)
            txt = htmlmod.unescape(txt).split(",")[0].strip()
            if a or re.fullmatch(r"[^\W\d_][\w'’\- ]*", txt):
                out.append(txt)
        return uniq(out)
    txt = htmlmod.unescape(TAG_RE.sub("", section_html)).replace("\xa0", " ")
    return uniq(p.strip() for p in txt.split(","))


def parse_frdic(query: str, page: str) -> dict:
    rec = base_record("frdic", query)
    hw_m = re.search(r'<p class="cf-words">([^<]+)</p>', page) or re.search(r"<title>([^<|_\-]+)", page)
    rec["final_headword"] = nfc(htmlmod.unescape(hw_m.group(1))).strip() if hw_m else query
    syn: list[str] = []
    ant: list[str] = []
    derived: list[str] = []
    forms: dict[str, list[str]] = {}
    found_any = False
    for m in H5_RE.finditer(page):
        kind = frdic_heading_kind(m.group(1))
        if not kind:
            continue
        rest = page[m.end():]
        rest_l = rest.lstrip()
        if rest_l.startswith("<ul"):
            end = rest_l.find("</ul>")
            sec = rest_l[: end if end >= 0 else 3000]
        else:
            nx = SECTION_END_RE.search(rest)
            sec = rest[: nx.start() if nx else 3000]
        items = [x for x in frdic_items(sec) if x and len(x) <= 60]
        if not items:
            continue
        found_any = True
        if kind == "syn":
            syn += items
        elif kind == "ant":
            ant += items
        elif kind in ("derived", "adv"):
            derived += items
        elif kind == "noun" and re.search(r"(er|ir|re|oir)$", query):
            derived += items  # 名词变化 of a verb is a deverbal noun (prendre -> prise)
        else:
            tag = "adj" if kind == "adj" else "noun"
            for it in items:
                if it.endswith("ment") and not query.endswith("ment"):
                    derived.append(it)  # -ment adverbs are derivations, not inflections
                else:
                    forms.setdefault(tag, [])
                    if it not in forms[tag]:
                        forms[tag].append(it)
    rec["syn"] = uniq(syn)
    rec["ant"] = uniq(ant)
    rec["derived"] = uniq(derived)
    rec["forms"] = forms
    if found_any and (rec["syn"] or rec["ant"] or rec["derived"]):
        rec["status"] = "ok"
    elif "explain" in page or "dict-word" in page or "cf-words" in page:
        rec["status"] = "empty"
    else:
        rec["status"] = "miss"
    return rec


def curl_get(url: str, timeout: int = 25) -> tuple[int, str, str, str]:
    cmd = ["curl", "-sS", "--max-time", str(timeout), "-A", UA, "-H", "Accept-Language: zh-CN,fr;q=0.8",
           "-D", "-", "-o", "-", url]
    p = subprocess.run(cmd, capture_output=True, timeout=timeout + 10)
    out = p.stdout.decode("utf-8", "replace")
    if p.returncode != 0:
        return 0, "", "", p.stderr.decode("utf-8", "replace").strip()[:200]
    head, _, body = out.partition("\r\n\r\n")
    # skip intermediate 100-continue blocks
    while head.startswith("HTTP/") and " 100" in head.split("\r\n", 1)[0] and body.startswith("HTTP/"):
        head, _, body = body.partition("\r\n\r\n")
    status_line = head.split("\r\n", 1)[0]
    try:
        code = int(status_line.split()[1])
    except (IndexError, ValueError):
        code = 0
    loc = ""
    retry_after = ""
    for line in head.split("\r\n")[1:]:
        k, _, v = line.partition(":")
        if k.lower() == "location":
            loc = v.strip()
        elif k.lower() == "retry-after":
            retry_after = v.strip()
    return code, body, loc, retry_after


def crawl_frdic(query: str, pos_hint: str, pacer: Pacer) -> dict:
    url = f"https://www.frdic.com/dicts/fr/{urllib.parse.quote(query, safe='')}"
    last = base_record("frdic", query)
    for attempt in range(4):
        pacer.wait()
        try:
            code, body, loc, retry_after = curl_get(url)
        except subprocess.TimeoutExpired:
            code, body, loc, retry_after = 0, "", "", "timeout"
        if code in (301, 302, 303, 307) and "login" in loc.lower():
            # frdic also answers unknown words with a /login redirect: record it, stop after 3 in a row
            last["status"] = "login_wall"
            last["error"] = f"redirect {loc}"[:200]
            pacer.login_walls += 1
            if pacer.login_walls >= 3:
                raise StopSource(f"frdic login wall x{pacer.login_walls} ({loc})")
            return last
        if code in (429, 503):
            try:
                wait_s = float(retry_after or 60)
            except ValueError:
                wait_s = 60.0
            pacer.backoff(min(max(wait_s, 10.0), 300.0))
            last["status"] = "throttled"
            if pacer.throttles >= 3:
                raise StopSource("frdic throttled")
            continue
        if code == 200 and body:
            if "/Account/Login" in body and "近义词" not in body and "<h5" not in body:
                last["status"] = "login_wall"
                raise StopSource("frdic login page served")
            rec = parse_frdic(query, body)
            rec["url"] = url
            pacer.login_walls = 0
            return rec
        if code == 404:
            last["status"] = "miss"
            return last
        last["error"] = (retry_after or f"HTTP {code}")[:200]  # TLS EOF / timeout are common on frdic: retry
        time.sleep(3 * (attempt + 1))
    return last


# ---------------------------------------------------------------- word selection
def select_words(tier: str, source: str) -> list[tuple[str, str]]:
    entries = load_lexdb_entries()
    rows = []
    for e in entries.values():
        w = e["w"]
        if " " in w or "/" in w or not re.fullmatch(r"[^\W\d_][\w'’\-]*", w):
            continue
        rank = e.get("rank") or 999999
        if tier == "b2" and e.get("level") != "B2":
            continue
        if tier == "atlas" and not e.get("atlasId"):
            continue
        if tier == "top15k" and rank > 15000:
            continue
        lacking = (0 if not e.get("ant") else 1) + (0 if not e.get("syn") else 1)
        p0 = (e.get("pos") or [{}])[0].get("p", "")
        rows.append(((lacking, 0 if e.get("atlasId") else 1, rank, w), w, p0))
    rows.sort()
    seen = set()
    out = []
    for _, w, p0 in rows:
        if w not in seen:
            seen.add(w)
            out.append((w, p0))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["cnrtl", "frdic", "both"], default="cnrtl")
    ap.add_argument("--limit", type=int, default=200, help="max new queries per source")
    ap.add_argument("--delay", type=float, default=None, help="seconds between requests per worker (jittered); default 0.25 cnrtl / 2.0 frdic")
    ap.add_argument("--concurrency", type=int, default=None, help="workers; default 2 cnrtl / 1 frdic")
    ap.add_argument("--resume", dest="resume", action="store_true", default=True)
    ap.add_argument("--no-resume", dest="resume", action="store_false", help="re-crawl queries already recorded")
    ap.add_argument("--words", default="", help="comma-separated explicit query words (overrides --tier)")
    ap.add_argument("--tier", choices=["b2", "atlas", "top15k"], default="b2")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    writer = Writer(Path(args.out))
    done = writer.load_done() if args.resume else {}
    entries_pos: dict[str, str] = {}
    if args.words:
        for e in load_lexdb_entries().values():
            entries_pos.setdefault(e["w"], (e.get("pos") or [{}])[0].get("p", ""))
        words = [(nfc(w).strip(), entries_pos.get(nfc(w).strip(), "")) for w in args.words.split(",") if w.strip()]
    else:
        words = select_words(args.tier, args.source)

    sources = ["cnrtl", "frdic"] if args.source == "both" else [args.source]
    for src in sources:
        delay = args.delay if args.delay is not None else (0.25 if src == "cnrtl" else 2.0)
        conc = args.concurrency if args.concurrency is not None else (2 if src == "cnrtl" else 1)
        if src == "frdic":
            conc = 1  # frdic: always sequential
        todo = []
        for w, p in words:
            prev = done.get((src, w))
            if prev and prev.get("status") in DONE_STATUSES and prev.get("parser_version") == PARSER_VERSION:
                continue
            todo.append((w, p))
            if len(todo) >= args.limit:
                break
        print(f"[crawl:{src}] {len(todo)} queries (delay={delay}s, workers={conc}, resume={args.resume})", flush=True)
        pacer = Pacer(delay)
        stop = threading.Event()
        stats: dict[str, int] = {}
        fn = crawl_cnrtl if src == "cnrtl" else crawl_frdic
        t0 = time.time()

        def work(item):
            if stop.is_set():
                return
            w, p = item
            try:
                rec = fn(w, p, pacer)
            except StopSource as e:
                print(f"[crawl:{src}] stopping source cleanly: {e}", flush=True)
                stop.set()
                rec = base_record(src, w)
                rec["status"] = "login_wall" if "login" in str(e) else "throttled"
                rec["error"] = str(e)[:200]
            except Exception as e:  # never fail the run on one word
                rec = base_record(src, w)
                rec["error"] = f"{type(e).__name__}: {e}"[:200]
            writer.append(rec)
            stats[rec["status"]] = stats.get(rec["status"], 0) + 1
            n = sum(stats.values())
            if n % 25 == 0:
                print(f"[crawl:{src}] {n}/{len(todo)} {stats} ({time.time() - t0:.0f}s)", flush=True)

        with ThreadPoolExecutor(max_workers=max(1, conc)) as ex:
            list(ex.map(work, todo))
        print(f"[crawl:{src}] done {stats} in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
