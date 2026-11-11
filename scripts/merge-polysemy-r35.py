"""Round 35: one card per meaning, each card listing every sense of the word.

For each spelling shared by several visible entries:
  A. entries with no gloss at all are aliased to the group's main entry (dropped as duplicates);
  C. entries with the same glosses and compatible gender are aliased to the first one (exact duplicates);
  B. locutions (loc.) are aliased to the first remaining card and their senses are added to it;
  D. every remaining card lists its own senses first, then the senses of its siblings (with their own pos).
Aliased entries stay in the file (aliasOf) so learning records remain reachable.
Writes data/lexicon.json in place and prints one line per group for review.
"""
import json, sys, collections, copy, re

PATH = "data/lexicon.json"
# always start from the file before this round, so the script can be rerun
lex = json.load(open("/home/claude/lexicon.before-polysemy.json", encoding="utf-8"))
ents = lex["entries"]
by_id = {e["id"]: e for e in ents}

def gender(e):
    p = e["pos"]
    if p == "n.m.": return "m"
    if p == "n.f.": return "f"
    return None  # n.m./f., n., non-nouns: compatible with anything

def zhset(e):
    return {s["zh"] for s in e["senses"] if s.get("zh")}

def tokens(e):
    """Glosses split on ； ; ，， with parenthetical examples removed: "孩子；儿童" -> {孩子, 儿童}."""
    out = set()
    for z in zhset(e):
        z = re.sub(r"[（(].*?[）)]", "", z)
        out |= {t.strip() for t in re.split(r"[；;，,]", z) if t.strip()}
    return out

def cls(e):
    """Part-of-speech class: nouns together, everything else on its own. Only the same class can merge."""
    return "noun" if e["pos"].startswith("n.") else e["pos"]

def compatible(a, b):
    if cls(a) != cls(b):
        return False
    ga, gb = gender(a), gender(b)
    return not (ga and gb and ga != gb)

def pos_of(sense, e):
    return sense.get("pos") or e["pos"]

def with_pos(sense, e):
    s = copy.deepcopy(sense)
    s.setdefault("pos", e["pos"])
    return s

groups = collections.defaultdict(list)
for e in ents:
    if not e.get("aliasOf"):
        groups[e["lemma"].lower()].append(e)

log = []
for key, members in groups.items():
    if len(members) < 2:
        continue
    # A. entries without any gloss
    glossed = [e for e in members if zhset(e)]
    if not glossed:
        continue  # nothing to show: leave the group as it is, reported below
    kept = []
    for e in glossed:
        if e["pos"] in ("loc.", "loc. adv."):
            continue
        # C. exact duplicate of an earlier kept card
        dup = next((k for k in kept if compatible(k, e) and (zhset(k) == zhset(e) or (tokens(e) and tokens(e) <= tokens(k)))), None)
        if dup:
            e["aliasOf"] = dup["id"]
            continue
        kept.append(e)
    if not kept:
        kept = [glossed[0]]
    # B. locutions join the first kept card
    host = kept[0]
    for e in glossed:
        if e["pos"] in ("loc.", "loc. adv.") and not e.get("aliasOf"):
            e["aliasOf"] = host["id"]
    for e in members:
        if e.get("aliasOf") is None and e not in kept and not zhset(e):
            e["aliasOf"] = host["id"]
    # D. every card: own senses first, then siblings' senses not already listed
    donors = [e for e in members if e.get("aliasOf") is None or e["aliasOf"] in {k["id"] for k in kept}]
    for k in kept:
        own = [with_pos(s, k) for s in k["senses"] if s.get("zh")]
        seen = set()
        out = []
        for s in own:
            if s["zh"] in seen: continue
            seen.add(s["zh"]); out.append(s)
        for e in members:
            if e is k or not zhset(e): continue
            if e.get("aliasOf") not in (None, k["id"]) and e["aliasOf"] != k["id"]:
                continue
            for s in e["senses"]:
                if s.get("zh") and s["zh"] not in seen:
                    seen.add(s["zh"]); out.append(with_pos(s, e))
        k["senses"] = out
    for e in members:
        if e.get("aliasOf") and e["aliasOf"] in by_id and by_id[e["aliasOf"]].get("aliasOf"):
            raise SystemExit(f"chain alias {e['id']}")
    log.append((key, [(e["id"], e["pos"], "ALIAS→" + e["aliasOf"] if e.get("aliasOf") else "card", [s.get("pos", e["pos"]) + ":" + s["zh"] for s in e["senses"] if s.get("zh")]) for e in members]))

# Corrections agreed for the first ten groups (see review table)
M = {e["id"]: e for e in lex["entries"]}
def drop_sense(eid, zh):
    M[eid]["senses"] = [x for x in M[eid]["senses"] if x.get("zh") != zh]
def fix_sense(eid, old, new):
    for x in M[eid]["senses"]:
        if x.get("zh") == old: x["zh"] = new
def set_sense_pos(eid, old_pos, new_pos):
    for x in M[eid]["senses"]:
        if x.get("pos") == old_pos: x["pos"] = new_pos
# amateur: masculine duplicate merged into the noun card; adjective gloss was wrong
M["amateur-m"]["aliasOf"] = "amateur"
M["amateur-"].pop("aliasOf", None)
drop_sense("amateur", "业余爱好者；业余的（en amateur 业余）")
drop_sense("amateur-", "业余爱好者；业余的（en amateur 业余）")
# the adjective's gloss, wherever it was copied (own card and the noun card's sibling list)
for eid in ("amateur", "amateur-"):
    for x in M[eid]["senses"]:
        if x.get("zh") == "爱好者" and x.get("pos") == "adj.": x["zh"] = "业余的"
fix_sense("amateur-", "爱好者", "业余的")
# cher: duplicate sense of the adjective removed
drop_sense("cher", "贵的；昂贵的")
# actif: stray English in the gloss
fix_sense("actif-m", "资产；active 的阳性名词用法", "资产")
for eid in ("actif", "actif-m"):
    for x in M[eid]["senses"]:
        if x.get("zh") == "资产；active 的阳性名词用法": x["zh"] = "资产"
# commercial noun: masculine and feminine alike
M["commercial-n"]["pos"] = "n.m./f."
for eid in ("commercial",):
    set_sense_pos(eid, "n.m.", "n.m./f.")
# cinéaste: masculine duplicate merged
M["cineaste-m"]["aliasOf"] = "cineaste"
drop_sense("cineaste", "电影人；导演")

# an alias that pointed at an entry merged this round now points at the card that absorbed it
ids = {e["id"]: e for e in lex["entries"]}
for e in lex["entries"]:
    seen = 0
    while e.get("aliasOf") and ids[e["aliasOf"]].get("aliasOf") and seen < 10:
        e["aliasOf"] = ids[e["aliasOf"]]["aliasOf"]; seen += 1

json.dump(lex, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
final = collections.defaultdict(list)
for e in lex["entries"]:
    final[e["lemma"].lower()].append(e)
with open("/home/claude/merge-r35-log.txt", "w", encoding="utf-8") as f:
    for k, members in final.items():
        if len(members) < 2: continue
        f.write(f"## {k}\n")
        for e in members:
            st = "ALIAS→" + e["aliasOf"] if e.get("aliasOf") else "card"
            f.write(f"  {e['id']} {e['pos']} {st} {[(x.get('pos', e['pos']) + ':' + x['zh']) for x in e['senses'] if x.get('zh')]}\n")
print("groups processed:", len(log))
