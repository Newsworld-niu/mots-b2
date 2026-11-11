#!/usr/bin/env python3
"""Fetch Larousse (français) entries for the r30 language-quality sample and cache them.
Usage: python3 scripts/fetch-larousse-r30.py <word> [word...]
Writes/updates data/dictionary/r30-larousse.json."""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

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
        txt = clean(mm.group(1))
        txt = re.sub(r"^\d+\.\s*", "", txt)
        if txt:
            defs.append(txt[:300])
        if len(defs) >= 6:
            break
    out["definitions"] = defs
    return out


def main():
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    for word in sys.argv[1:]:
        if word in cache and cache[word].get("category"):
            continue
        url = "https://www.larousse.fr/dictionnaires/francais/" + urllib.parse.quote(word)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            html = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
            data = parse(html)
            data["url"] = url
            data["http"] = 200
        except Exception as e:
            data = {"url": url, "error": str(e)}
        cache[word] = data
        print(f"{word}: {data.get('category')!r} {str(data.get('definitions',[''])[:1])[:80]}")
        time.sleep(0.6)
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("cached:", len(cache))


if __name__ == "__main__":
    main()
