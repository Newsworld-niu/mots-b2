#!/usr/bin/env python3
"""r31 POS fill: for learnable entries with pos=待核实, read the first French
part-of-speech section on fr.wiktionary and set a concrete POS. Evidence cached.
Idempotent."""
import csv
import json
import os
import re
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
CACHE = os.path.join(ROOT, "data/dictionary/r31-wiktionary-pos.json")
LOG = os.path.join(ROOT, "output/r31-pos-log.csv")
UA = "word-atlas/1.0 (educational vocabulary project)"
MAP = {"nom": None, "adjectif": "adj.", "verbe": "v.", "adverbe": "adv.",
       "préposition": "prép.", "conjonction": "conj.", "interjection": "interj.",
       "pronom": "pron.", "locution": "loc."}


def get(titles):
    url = ("https://fr.wiktionary.org/w/api.php?action=query&prop=revisions&rvslots=main"
           "&rvprop=content&format=json&formatversion=2&titles=" + urllib.parse.quote(titles))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=25))


def parse_pos(wt):
    m = re.search(r"\{\{S\|(nom|adjectif|verbe|adverbe|préposition|conjonction|interjection|pronom|locution)\|fr", wt)
    if not m:
        return None, None
    sect = m.group(1)
    pos = MAP.get(sect)
    marker = None
    if sect == "nom":
        seg = wt[m.start():m.start() + 400]
        mk = re.findall(r"\{\{(m|f|mf|m\|fr|f\|fr|mf\|fr)\}\}", seg)
        marker = mk[0] if mk else None
        if marker and marker.startswith("mf"):
            pos = "n.m./f."
        elif marker and marker.startswith("m"):
            pos = "n.m."
        elif marker and marker.startswith("f"):
            pos = "n.f."
        else:
            pos = None  # noun but gender unclear -> leave pending
    return pos, sect + ("/" + marker if marker else "")


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    targets = [e for e in lex["entries"] if not e.get("aliasOf") and e["pos"] == "待核实"
               and any(s.get("zh", "").strip() for s in e.get("senses", []))]
    lemmas = [e["lemma"] for e in targets]
    todo = [w for w in lemmas if w not in cache]
    for i in range(0, len(todo), 50):
        batch = todo[i:i + 50]
        for attempt in range(4):
            try:
                d = get("|".join(batch))
                for p in d["query"]["pages"]:
                    wt = p.get("revisions", [{}])[0].get("slots", {}).get("main", {}).get("content", "")
                    pos, ev = parse_pos(wt)
                    cache[p["title"]] = {"pos": pos, "evidence": ev}
                break
            except Exception as e:
                if "429" in str(e):
                    time.sleep(5 + attempt * 5); continue
                for w in batch:
                    cache[w] = {"error": str(e)}
                break
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(1)
    applied = 0
    log = []
    for e in targets:
        info = cache.get(e["lemma"], {})
        pos = info.get("pos")
        if pos:
            e["pos"] = pos
            e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + f"r31 词性（fr.wiktionary：{info.get('evidence')}）。").strip()
            applied += 1
            log.append({"id": e["id"], "lemma": e["lemma"], "pos": pos, "evidence": info.get("evidence")})
        else:
            log.append({"id": e["id"], "lemma": e["lemma"], "pos": "", "evidence": info.get("evidence", "unresolved")})
    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "lemma", "pos", "evidence"])
        w.writeheader(); w.writerows(log)
    print("pos applied:", applied, "of", len(targets))


if __name__ == "__main__":
    main()
