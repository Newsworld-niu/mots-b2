"""Queries Larousse français–chinois for each single-word lemma of lesson 1 and records the raw evidence.
Output: data/dictionary/larousse-lesson01.json (one record per lemma: url, status, headword, category, gender, zh)."""
import json, re, subprocess, urllib.parse, html, sys
exec(open("scripts/batch/lesson01-items.py", encoding="utf-8").read())

def base(lemma):
    t = re.sub(r"\s*\((s'|se)\)", "", lemma)
    t = re.sub(r"\((e|ne)\)", "", t).strip()
    return t
CAT = re.compile(r"(nom masculin et féminin|nom masculin|nom féminin|nom|verbe|adjectif|adverbe|interjection|pronom|préposition|conjonction|locution)")
def parse(text, word):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", text, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t)); t = re.sub(r"\s+", " ", t)
    m = re.search(r"Français-Chinois\s*>\s*" + re.escape(word) + r"\s+(.{0,400})", t)
    if not m: return None
    seg = m.group(1)
    cat = CAT.search(seg)
    cjk = re.search(r"([\u4e00-\u9fff][^\[]{0,60}?)\s*\[", seg)
    gender = None
    if cat:
        c = cat.group(1)
        gender = "mf" if "et féminin" in c else "m" if "masculin" in c else "f" if "féminin" in c else None
    return {"headword_seen": True, "category": cat.group(1) if cat else None, "gender": gender,
            "zh": cjk.group(1).strip() if cjk else None, "snippet": seg[:160]}
out = {}
for lemma, kind, gbody, zh, ex, exzh, page in ITEMS:
    b = base(lemma)
    if " " in b or "'" in b or "—" in b:
        out[lemma] = {"queried": False, "reason": "短语，不单独查询"}; continue
    url = f"https://www.larousse.fr/dictionnaires/francais-chinois/{urllib.parse.quote(b)}/"
    r = subprocess.run(["curl", "-sL", "-A", "Mozilla/5.0", "--max-time", "25", "-o", "/tmp/lar.html", "-w", "%{http_code} %{url_effective}", url], capture_output=True, text=True)
    code, final = (r.stdout.split(" ", 1) + [""])[:2]
    rec = {"queried": True, "url": final, "http": code, "lookup": b}
    try:
        txt = open("/tmp/lar.html", encoding="utf-8", errors="ignore").read()
        p = parse(txt, b) if code == "200" else None
        rec.update(p or {"headword_seen": False})
    except Exception as e:
        rec["error"] = str(e)
    out[lemma] = rec
    print(f"{lemma:28} http={code} gender={rec.get('gender')} cat={rec.get('category')} zh={(rec.get('zh') or '')[:18]}", flush=True)
json.dump(out, open("data/dictionary/larousse-lesson01.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("queried:", sum(1 for v in out.values() if v.get("queried")), "found:", sum(1 for v in out.values() if v.get("headword_seen")))
