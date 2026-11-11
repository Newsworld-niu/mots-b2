#!/usr/bin/env python3
"""Parallel Larousse fetch with cache. Usage: python3 scripts/fetch-larousse-parallel.py word1 word2 ..."""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data/dictionary/r30-larousse.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


def clean(s):
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#039;", "'").replace("&quot;", '"')
    return re.sub(r"\s+", " ", s).strip()


def parse(html):
    out = {}
    m = re.search(r'<h2 class="AdresseDefinition">(.*?)</h2>', html, re.S)
    out["headword"] = clean(m.group(1)) if m else None
    m = re.search(r'<p class="CatgramDefinition">(.*?)</p>', html, re.S)
    out["category"] = clean(m.group(1)) if m else None
    defs = []
    for mm in re.finditer(r'<li class="DivisionDefinition">(.*?)</li>', html, re.S):
        txt = clean(mm.group(1)); txt = re.sub(r"^\d+\.\s*", "", txt)
        if txt:
            defs.append(txt[:300])
        if len(defs) >= 4:
            break
    out["definitions"] = defs
    return out


def fetch(word):
    url = "https://www.larousse.fr/dictionnaires/francais/" + urllib.parse.quote(word)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        html = urllib.request.urlopen(req, timeout=15).read().decode("utf-8", "ignore")
        d = parse(html); d["url"] = url; d["http"] = 200
        return word, d
    except Exception as e:
        return word, {"url": url, "error": str(e)}


def main():
    words = [w for w in sys.argv[1:] if w.strip()]
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = [w for w in words if w not in cache or not cache[w].get("category")]
    print(f"requested {len(words)}, cached {len(words)-len(todo)}, fetching {len(todo)}")
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs = {ex.submit(fetch, w): w for w in todo}
        for i, fu in enumerate(as_completed(futs), 1):
            w, d = fu.result()
            cache[w] = d
            if i % 20 == 0:
                print(f"  {i}/{len(todo)}")
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("cache size", len(cache))


if __name__ == "__main__":
    main()
