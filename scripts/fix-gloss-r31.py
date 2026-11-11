#!/usr/bin/env python3
"""Fix the r31 gloss parse artifact: restore the 339 glossed entries' senses/note from
the pre-r31 snapshot, then re-fetch with a corrected parser that skips the
(classifier) note, and re-apply. Idempotent."""
import csv
import html
import json
import os
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
BEFORE = os.path.join(ROOT, "data/snapshots/lexicon-before-r31.json")
LOG_IN = os.path.join(ROOT, "output/r31-gloss-log.csv")
LOG_OUT = os.path.join(ROOT, "output/r31-gloss-fix-log.csv")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


def parse_zh(text, word):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\s+", " ", t)
    m = re.search(r"Français-Chinois\s*>\s*" + re.escape(word) + r"\s+(.{0,500})", t)
    if not m:
        return None
    seg = m.group(1)
    seg = re.sub(r"\(cl\.[^)]*\)", " ", seg)  # drop "(cl. 场 [chǎng])" classifier notes
    cjk = re.search(r"([\u4e00-\u9fff][^\[]{0,60}?)\s*\[", seg)
    if cjk:
        return cjk.group(1).strip()
    cjk2 = re.search(r"([\u4e00-\u9fff]{2,}[^\[]{0,40})", seg)
    return cjk2.group(1).strip() if cjk2 else None


def fetch(word):
    url = "https://www.larousse.fr/dictionnaires/francais-chinois/" + urllib.parse.quote(word) + "/"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            h = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")
            return word, parse_zh(h, word)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(3 + attempt * 3); continue
            return word, None
        except Exception:
            return word, None
    return word, None


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    before = {e["id"]: e for e in json.load(open(BEFORE, encoding="utf-8"))["entries"]}
    by_id = {e["id"]: e for e in lex["entries"]}
    rows = [r for r in csv.DictReader(open(LOG_IN, encoding="utf-8")) if r["action"] == "gloss"]

    # 1. restore senses + note from the pre-r31 snapshot for these entries
    restored = 0
    for r in rows:
        e = by_id.get(r["id"]); b = before.get(r["id"])
        if not e or not b or e.get("aliasOf"):
            continue
        e["senses"] = b["senses"]
        if "note" in b:
            e["note"] = b["note"]
        elif "note" in e:
            del e["note"]
        restored += 1
    print("restored:", restored)

    # 2. re-fetch with fixed parser
    lemmas = list({r["lemma"] for r in rows})
    results = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for i, fu in enumerate(as_completed({ex.submit(fetch, w): w for w in lemmas}), 1):
            w, zh = fu.result()
            results[w] = zh
            if i % 50 == 0:
                print(f"  fetched {i}/{len(lemmas)}")
    print("with zh:", sum(1 for v in results.values() if v))

    # 3. re-apply
    applied = 0
    log = []
    MEASURE = set("场把位名种个支笔张块次番尊棵首段道间件条只匹头峰")
    for r in rows:
        e = by_id.get(r["id"])
        if not e or e.get("aliasOf"):
            continue
        zh = results.get(r["lemma"])
        if not zh:
            log.append({"id": e["id"], "lemma": e["lemma"], "action": "skipped", "detail": "no zh"}); continue
        if len(zh) == 1 and zh in MEASURE:
            log.append({"id": e["id"], "lemma": e["lemma"], "action": "skipped", "detail": f"measure-word guard: {zh}"}); continue
        e["senses"] = [s for s in e.get("senses", []) if not s.get("zh", "").strip()] or [{"zh": "", "fr": "", "origin": "book"}]
        e["senses"].append({"zh": zh, "fr": "", "origin": "supplement", "status": "补充翻译·待核对"})
        e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + "r31 释义来源：Larousse 中法词典。").strip()
        applied += 1
        log.append({"id": e["id"], "lemma": e["lemma"], "action": "gloss", "detail": zh})
    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    with open(LOG_OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "lemma", "action", "detail"]); w.writeheader(); w.writerows(log)
    print("glosses re-applied:", applied, "of", len(rows))


if __name__ == "__main__":
    main()
