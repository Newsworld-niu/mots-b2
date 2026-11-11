#!/usr/bin/env python3
"""Fetch French Wiktionary gender/POS for nouns, with cache. Parallel.
Usage: python3 scripts/fetch-wiktionary.py word1 word2 ..."""
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data/dictionary/r31-wiktionary.json")
UA = "word-atlas/1.0 (educational vocabulary project)"


def parse_gender(wt):
    # first French noun section
    m = re.search(r"==\s*\{\{S\|nom\|fr[^}]*\}\}\s*==(.*?)(?=\n==[^=]|\Z)", wt, re.S)
    if not m:
        # some pages use {{S|nom|fr}} inside a level-3 header
        m = re.search(r"===\s*\{\{S\|nom\|fr[^}]*\}\}\s*===(.*?)(?=\n===|\n==[^=]|\Z)", wt, re.S)
    if not m:
        return None, None
    seg = m.group(1)
    head = seg.split("\n#")[0]
    markers = re.findall(r"\{\{(m|f|mf|m\|fr|f\|fr|mf\|fr|m-et-f|f-et-m)\}\}", head)
    if not markers:
        markers = re.findall(r"\{\{(m|f|mf)\}\}", seg[:400])
    if not markers:
        return None, None
    mk = markers[0]
    if mk.startswith("mf") or mk in ("m-et-f", "f-et-m"):
        return "n.m./f.", mk
    if mk.startswith("m"):
        return "n.m.", mk
    if mk.startswith("f"):
        return "n.f.", mk
    return None, mk


def fetch(word):
    import time
    url = "https://fr.wiktionary.org/w/api.php?action=parse&page=" + urllib.parse.quote(word) + "&prop=wikitext&format=json&formatversion=2"
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            d = json.load(urllib.request.urlopen(req, timeout=20))
            wt = d.get("parse", {}).get("wikitext", "")
            pos, mk = parse_gender(wt)
            return word, {"url": url, "pos": pos, "marker": mk, "http": 200}
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 + attempt * 2)
                continue
            return word, {"url": url, "error": str(e)}
        except Exception as e:
            return word, {"url": url, "error": str(e)}
    return word, {"url": url, "error": "429 after retries"}


def main():
    words = [w for w in sys.argv[1:] if w.strip()]
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = [w for w in words if w not in cache or not cache[w].get("pos")]
    print(f"requested {len(words)}, fetching {len(todo)}")
    with ThreadPoolExecutor(max_workers=3) as ex:
        for fu in as_completed({ex.submit(fetch, w): w for w in todo}):
            w, d = fu.result()
            cache[w] = d
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("cache size", len(cache))


if __name__ == "__main__":
    main()
