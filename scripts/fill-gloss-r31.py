#!/usr/bin/env python3
"""r31 gloss fill: for visible entries with no gloss, distinguish real single-word
headwords from OCR noise / titles / sentence fragments, then look up the real ones
in the Larousse French-Chinese dictionary and fill a Chinese gloss.

Fragments/noise are only annotated (never guessed). Glosses carry the usual
「补充翻译·待核对」 status and record the dictionary URL. Idempotent."""
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
LOG = os.path.join(ROOT, "output/r31-gloss-log.csv")
CACHE = os.path.join(ROOT, "data/dictionary/r31-larousse-zh.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
CAT = re.compile(r"(nom masculin et féminin|nom masculin|nom féminin|nom|verbe|adjectif|adverbe|interjection|pronom|préposition|conjonction|locution)")


def has_gloss(e):
    return any(s.get("zh", "").strip() for s in e.get("senses", []))


def is_noise(lemma):
    if any(c in lemma for c in "*[]()"):
        return True
    if re.search(r"[A-Z]", lemma[1:]) and not re.search(r"['\-][A-Z]?", lemma):
        # internal capital like "chaTne" (but allow "Transports" style proper nouns? none here)
        return True
    if " " in lemma.strip() and not re.match(r"^[a-zA-Zà-ÿ'\- ]+$", lemma):
        return True
    return False


def is_fragment(e):
    note = e.get("note") or ""
    if "OCR 误识" in note or "章节标题" in note or "导语" in note:
        return True
    if len(e["lemma"].split()) >= 4:
        return True
    return False


def parse_zh(text, word):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\s+", " ", t)
    m = re.search(r"Français-Chinois\s*>\s*" + re.escape(word) + r"\s+(.{0,400})", t)
    if not m:
        return None
    seg = m.group(1)
    cjk = re.search(r"([\u4e00-\u9fff][^\[]{0,60}?)\s*\[", seg)
    return cjk.group(1).strip() if cjk else None


def fetch(word):
    url = "https://www.larousse.fr/dictionnaires/francais-chinois/" + urllib.parse.quote(word) + "/"
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            h = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")
            return word, {"url": url, "zh": parse_zh(h, word)}
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(3 + attempt * 3)
                continue
            return word, {"url": url, "error": str(e)}
        except Exception as e:
            return word, {"url": url, "error": str(e)}
    return word, {"url": url, "error": "rate limited"}


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    ng = [e for e in lex["entries"] if not e.get("aliasOf") and not has_gloss(e)]
    noise, frag, candidates = [], [], []
    for e in ng:
        if is_noise(e["lemma"]):
            noise.append(e)
        elif is_fragment(e):
            frag.append(e)
        elif len(e["lemma"].split()) == 1:
            candidates.append(e)
        else:
            frag.append(e)  # multi-word without evidence: keep unglossed
    print(f"no-gloss={len(ng)} noise={len(noise)} fragment={len(frag)} single-word candidates={len(candidates)}")

    todo = [e["lemma"] for e in candidates if e["lemma"] not in cache]
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = {ex.submit(fetch, w): w for w in todo}
        for i, fu in enumerate(as_completed(futs), 1):
            w, d = fu.result()
            cache[w] = d
            if i % 50 == 0:
                print(f"  fetched {i}/{len(todo)}")
                json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    applied = 0
    skipped = 0
    log = []
    for e in noise:
        note = "r31 归类：OCR 噪声词形，非独立词条；不补释义。"
        if note not in (e.get("note") or ""):
            e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + note).strip()
    for e in frag:
        note = "r31 归类：导语/标题/多词片段，非独立词条；不补释义。"
        if note not in (e.get("note") or ""):
            e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + note).strip()
    for e in candidates:
        info = cache.get(e["lemma"], {})
        zh = info.get("zh")
        if zh:
            e["senses"] = [s for s in e.get("senses", []) if not s.get("zh", "").strip()] or [{"zh": "", "fr": "", "origin": "book"}]
            e["senses"].append({"zh": zh, "fr": "", "origin": "supplement", "status": "补充翻译·待核对"})
            e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") + f"r31 释义来源：Larousse 中法词典 {info.get('url')}。").strip()
            applied += 1
            log.append({"id": e["id"], "lemma": e["lemma"], "action": "gloss", "detail": zh})
        else:
            skipped += 1
            log.append({"id": e["id"], "lemma": e["lemma"], "action": "skipped", "detail": info.get("error", "no zh found")})
    json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    with open(LOG, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "lemma", "action", "detail"])
        w.writeheader(); w.writerows(log)
    print(f"glosses applied: {applied}; skipped candidates: {skipped}; annotated noise/fragment: {len(noise)+len(frag)}")


if __name__ == "__main__":
    main()
