#!/usr/bin/env python3
"""Fetch gender for the r31 noun list from French Wiktionary in batches, then apply
n.m./n.f./n.m./f. to entries currently typed as generic "n.".
Evidence cached in data/dictionary/r31-wiktionary.json; log in output/r31-gender-log.csv."""
import csv
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
NOUNS = os.path.join(ROOT, "output/r31-gender-nouns.csv")
CACHE = os.path.join(ROOT, "data/dictionary/r31-wiktionary.json")
LOG = os.path.join(ROOT, "output/r31-gender-log.csv")
UA = "word-atlas/1.0 (educational vocabulary project)"


def get(titles):
    url = ("https://fr.wiktionary.org/w/api.php?action=query&prop=revisions&rvslots=main"
           "&rvprop=content&format=json&formatversion=2&titles=" + urllib.parse.quote(titles))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=25))


def parse_gender(wt):
    m = re.search(r"==\s*\{\{S\|nom\|fr[^}]*\}\}\s*==(.*?)(?=\n==[^=]|\Z)", wt, re.S)
    if not m:
        return None, None
    head = m.group(1).split("\n#")[0]
    mk = re.findall(r"\{\{(m|f|mf|m\|fr|f\|fr|mf\|fr)\}\}", head)
    if not mk:
        return None, None
    k = mk[0]
    if k.startswith("mf"):
        return "n.m./f.", k
    if k.startswith("m"):
        return "n.m.", k
    if k.startswith("f"):
        return "n.f.", k
    return None, k


def main():
    rows = list(csv.DictReader(open(NOUNS, encoding="utf-8")))
    lemmas = [r["lemma"] for r in rows]
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    todo = [w for w in lemmas if w not in cache or cache[w].get("error") or not cache[w].get("pos")]
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        for attempt in range(4):
            try:
                d = get("|".join(batch))
                for p in d["query"]["pages"]:
                    wt = p.get("revisions", [{}])[0].get("slots", {}).get("main", {}).get("content", "")
                    pos, mk = parse_gender(wt)
                    cache[p["title"]] = {"pos": pos, "marker": mk}
                break
            except Exception as e:
                if "429" in str(e):
                    time.sleep(5 + attempt * 5)
                    continue
                for w in batch:
                    cache[w] = {"error": str(e)}
                break
        print(f"batch {i//50+1}: cache {len(cache)}")
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(1)

    lex = json.load(open(LEX, encoding="utf-8"))
    by_id = {e["id"]: e for e in lex["entries"]}
    log = []
    applied = 0
    unresolved = 0
    for r in rows:
        e = by_id.get(r["id"])
        if not e or e["pos"] != "n.":
            continue
        info = cache.get(e["lemma"], {})
        pos = info.get("pos")
        if pos:
            e["pos"] = pos
            e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + f"r31 阴阳性（fr.wiktionary {{nom}}：{info.get('marker')}）。").strip()
            applied += 1
            log.append({"id": e["id"], "lemma": e["lemma"], "pos": pos, "marker": info.get("marker")})
        else:
            unresolved += 1
    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "lemma", "pos", "marker"])
        w.writeheader()
        w.writerows(log)
    print("gender applied:", applied, "unresolved:", unresolved)


if __name__ == "__main__":
    main()
