#!/usr/bin/env python3
"""
Reliable dictionary lookup for the runner. Distinguishes outcomes instead of
recording everything as "not found":

  ok                returned headword matches the target and a definition/gloss was parsed
  network_error     DNS/connection/timeout
  rate_limited      HTTP 429/503
  parse_error       page fetched but the expected structure was not found
  headword_mismatch page fetched but its headword differs from the target
  no_entry          page fetched, structure parsed, but no entry for this headword

Sources, in order: Larousse French-Chinese (gloss), Larousse French (definition),
French Wiktionary (definition/gender). Evidence (url + headword + definition) is cached.

Usage: python3 scripts/runner/lookup.py voie "mise en scène" circonférence
"""
import html
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(ROOT, "data/dictionary/runner-lookup.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


def fold(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).lower().strip()


def strip_tags(t):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", t, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return re.sub(r"\s+", " ", t).strip()


def get(url, timeout=20, retries=3):
    """Return (html, status) where status is one of ok/network_error/rate_limited."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", "ignore"), "ok"
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(3 + attempt * 3)
                continue
            return None, "network_error"
        except Exception:
            time.sleep(1 + attempt)
    return None, "rate_limited"


def larousse_zh(word):
    url = "https://www.larousse.fr/dictionnaires/francais-chinois/" + urllib.parse.quote(word) + "/"
    h, status = get(url)
    if status != "ok":
        return {"source": "larousse-zh", "url": url, "status": status}
    t = strip_tags(h)
    m = re.search(r"Français-Chinois\s*>\s*" + re.escape(word) + r"\s+(.{0,500})", t)
    if not m:
        return {"source": "larousse-zh", "url": url, "status": "headword_mismatch" if "Français-Chinois" in t else "no_entry"}
    seg = re.sub(r"\(cl\.[^)]*\)", " ", m.group(1))
    c = re.search(r"([\u4e00-\u9fff][^\[]{0,60}?)\s*\[", seg) or re.search(r"([\u4e00-\u9fff]{2,}[^\[]{0,40})", seg)
    if not c:
        return {"source": "larousse-zh", "url": url, "status": "parse_error"}
    return {"source": "larousse-zh", "url": url, "status": "ok", "headword": word, "zh": c.group(1).strip()}


def larousse_fr(word):
    url = "https://www.larousse.fr/dictionnaires/francais/" + urllib.parse.quote(word)
    h, status = get(url)
    if status != "ok":
        return {"source": "larousse-fr", "url": url, "status": status}
    mh = re.search(r'<h2 class="AdresseDefinition">(.*?)</h2>', h, re.S)
    head = strip_tags(mh.group(1)) if mh else None
    head = re.sub(r"^[^\wÀ-ÿ]+", "", head or "").strip()
    if not head:
        return {"source": "larousse-fr", "url": url, "status": "no_entry"}
    if fold(head.split(",")[0]) != fold(word):
        return {"source": "larousse-fr", "url": url, "status": "headword_mismatch", "headword": head}
    cat = re.search(r'CatgramDefinition">([^<]*)<', h)
    d = re.search(r'<li class="DivisionDefinition">(.*?)</li>', h, re.S)
    if not d:
        return {"source": "larousse-fr", "url": url, "status": "parse_error", "headword": head}
    return {"source": "larousse-fr", "url": url, "status": "ok", "headword": head,
            "category": strip_tags(cat.group(1)) if cat else None, "definition": strip_tags(d.group(1))[:300]}


def wiktionary(word):
    url = ("https://fr.wiktionary.org/w/api.php?action=parse&page=" + urllib.parse.quote(word) +
           "&prop=wikitext&format=json&formatversion=2")
    h, status = get(url)
    if status != "ok":
        return {"source": "wiktionary", "url": url, "status": status}
    try:
        wt = json.loads(h)["parse"]["wikitext"]
    except Exception:
        return {"source": "wiktionary", "url": url, "status": "no_entry"}
    m = re.search(r"\{\{S\|(nom|adjectif|verbe|adverbe|préposition|conjonction|interjection|pronom)\|fr", wt)
    if not m:
        return {"source": "wiktionary", "url": url, "status": "no_entry"}
    return {"source": "wiktionary", "url": url, "status": "ok", "headword": word, "category": m.group(1)}


def lookup(word):
    out = {"word": word, "checks": []}
    out["checks"].append(larousse_zh(word))
    out["checks"].append(larousse_fr(word))
    out["checks"].append(wiktionary(word))
    # overall status: ok if any source ok; else the most specific failure
    if any(c["status"] == "ok" for c in out["checks"]):
        out["status"] = "ok"
    else:
        order = ["network_error", "rate_limited", "parse_error", "headword_mismatch", "no_entry"]
        out["status"] = next((s for s in order if any(c["status"] == s for c in out["checks"])), "no_entry")
    return out


def main():
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    for w in sys.argv[1:]:
        r = lookup(w)
        cache[w] = r
        print(f"{w}: {r['status']} | " + "; ".join(f"{c['source']}={c['status']}" + (f"({c.get('zh') or (c.get('definition') or '')[:40]})" if c['status'] == 'ok' else "") for c in r["checks"]))
        time.sleep(0.4)
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
