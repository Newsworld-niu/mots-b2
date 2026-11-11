#!/usr/bin/env python3
"""Resolve empty-gloss duplicate placeholders (pos 待核实) for the 21 items listed in lesson13-15 status.
Rule: merge a placeholder into the ONLY non-placeholder entry with the same lemma (same word, unknown pos
in the placeholder). Ambiguous cases (several candidates, or noun/verb/adj uses possible) stay in TODO.
Also: employe-m (n.m., mine, wrong pos) → employe (n., common gender, p.90 "un(e) employé(e)"): contents moved.
Aliases keep old ids; sources are copied to the primary. Log: output/lesson16-17/dedupe.log"""
import json, os, unicodedata
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
LEX = os.path.join(ROOT, "data/lexicon.json"); LOG = os.path.join(ROOT, "output/lesson16-17/dedupe.log")
lex = json.load(open(LEX, encoding="utf-8")); E = lex["entries"]
def fold(s):
    s = unicodedata.normalize("NFD", s); s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().replace("'", "").replace("-", " ").strip()
ID = {e["id"]: e for e in E}
key = lambda s: (s.get("book"), s.get("printedPage"), s.get("pdfPage"), s.get("kind"))
def copy_sources(src, dst):
    have = {key(s) for s in dst["sources"]}; n = 0
    for s in src["sources"]:
        if key(s) not in have: dst["sources"].append(s); n += 1
    return n
log, todo = [], []
# employe-m (n.m., my wrong pos) → employe (n.)
m, t = ID["employe-m"], ID["employe"]
assert t["pos"] == "n." and m["lemma"] == "employé"
for s in m["senses"]:
    if s["zh"] and not any(x["zh"] == s["zh"] for x in t["senses"]): t["senses"].append(s)
for ex in m["examples"]:
    if not any(x["fr"] == ex["fr"] for x in t["examples"]): t["examples"].append(ex)
n = copy_sources(m, t)
m["aliasOf"] = "employe"; m["note"] = "别名：指向 employe（n., 阴阳同形）。原误标 n.m. 已合并。旧 ID 保留。"
log.append(f"merge employe-m → employe (pos n.m. was wrong: employé(e) common gender); senses+examples moved; sources +{n}")

AMBIG = {"comme", "diner", "tout-", "fin-", "electronique-", "dejeuner-", "serveur-"}
SCOPE = {"addition","cher","eau","chef-","employe-","cantine","marche-","menage-","metro-","mousse-","serveur-","tablette","apres-midi","comme","diner","tout-","trois","electronique-","dejeuner-","fin-","midi-"}
placeholders = [e for e in E if e["id"] in SCOPE and e["pos"] == "待核实" and not e.get("aliasOf") and not e["examples"]]
for p in placeholders:
    if p["id"] in AMBIG or p.get("aliasOf"):
        todo.append(f"{p['id']} ({p['lemma']}): 多义或多候选，待办"); continue
    cands = [e for e in E if e is not p and not e.get("aliasOf") and e["pos"] != "待核实" and fold(e["lemma"]) == fold(p["lemma"])]
    if len(cands) == 1 and not any(s["zh"] for s in p["senses"]):
        c = cands[0]; n = copy_sources(p, c); p["aliasOf"] = c["id"]
        p["note"] = f"别名：指向 {c['id']}（同词，原待核实条目为空释义）。旧 ID 保留。"
        log.append(f"merge {p['id']} → {c['id']} ({c['lemma']} {c['pos']}); sources +{n}")
    else:
        todo.append(f"{p['id']} ({p['lemma']}): 候选 {[c['id'] for c in cands] or '无'}，待办")
json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2); open(LEX, "a", encoding="utf-8").write("\n")
os.makedirs(os.path.dirname(LOG), exist_ok=True)
open(LOG, "w", encoding="utf-8").write("\n".join(log + ["TODO:"] + todo) + "\n")
print(f"merged={len(log)-1} todo={len(todo)}")
