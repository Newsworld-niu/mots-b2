"""r41: merge near-duplicate senses and lift leftover "(phrase 中文)" notes out of glosses.

Why: entries merged from several books kept every book's gloss, so a word could show "为了；为" and
"为了；因为" as two senses (150 entries). Rule, deliberately conservative:
  * two senses are duplicates when they have the same part of speech and the same first gloss;
  * a group is merged into the position of its first member; the glosses of the other members are
    added only if no *other* sense of the entry already says that (so "培训；教育" does not steal
    "教育" from a separate "培养；教育" sense);
  * KEEP lists entries whose same-looking senses are really different meanings (domaine, nouvelle ...).
Then "（phrase 中文）" in a gloss moves to col as "phrase｜中文" (max 5 per entry, no repeats).
Usage: python3 scripts/fix-senses-r41.py [--apply]   (default: preview only, writes nothing)
Idempotent. Log: output/r41-senses-log.csv
"""
import csv, json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEX = os.path.join(ROOT, "data/lexicon.json")
LOG = os.path.join(ROOT, "output/r41-senses-log.csv")
APPLY = "--apply" in sys.argv

# same first gloss, different meanings: leave them as separate senses
KEEP = {"domaine", "epreuve", "nouvelle", "regle", "chaine", "somme", "somme-m", "public-m", "sujet-adj"}

PARTS = re.compile(r"[；;]")
CORE = re.compile(r"[；;，,（(]")
NOTE = re.compile(r"（([A-Za-zÀ-ÿœŒ’' .\-/+()]*?[A-Za-zÀ-ÿ)])\s*\+?\s*([一-鿿][^（）]*)）")


def core(zh):
    return CORE.split(zh)[0].strip()


def parts(zh):
    return [p.strip() for p in PARTS.split(zh) if p.strip()]


def fold(s):
    return re.sub(r"[^a-z]+", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()).strip()


def merge_senses(e):
    """Returns (new senses, list of (kept zh, merged-away zh)) or None when nothing to merge."""
    if e["id"] in KEEP:
        return None
    ss = e["senses"]
    idx = [i for i, s in enumerate(ss) if s.get("zh")]
    groups = {}
    for i in idx:
        groups.setdefault((ss[i].get("pos") or e["pos"], core(ss[i]["zh"])), []).append(i)
    if all(len(v) == 1 for v in groups.values()):
        return None
    first_parts = {k: set(parts(ss[v[0]]["zh"])) for k, v in groups.items()}
    new, done, notes = [], set(), []
    for i, s in enumerate(ss):
        if not s.get("zh"):
            new.append(s)
            continue
        key = (s.get("pos") or e["pos"], core(s["zh"]))
        if key in done:
            continue
        done.add(key)
        members = groups[key]
        if len(members) == 1:
            new.append(s)
            continue
        elsewhere = set().union(*(p for k, p in first_parts.items() if k != key)) if len(first_parts) > 1 else set()
        merged = parts(s["zh"])
        for j in members[1:]:
            for p in parts(ss[j]["zh"]):
                if p not in merged and p not in elsewhere:
                    merged.append(p)
        m = dict(s)
        m["zh"] = "；".join(merged)
        if not m.get("fr"):
            m["fr"] = next((ss[j]["fr"] for j in members[1:] if ss[j].get("fr")), "")
        new.append(m)
        notes.append((m["zh"], " // ".join(ss[j]["zh"] for j in members[1:])))
    return new, notes


def lift_notes(e):
    """Move "（phrase 中文）" from glosses to col. Returns the list of (before, after, col item)."""
    out = []
    have = {c.split("｜")[0].strip().lower() for c in e["col"]}
    for s in e["senses"]:
        m = NOTE.search(s.get("zh", ""))
        if not m or not s["zh"].endswith("）"):
            continue
        fr, zh = m.group(1).strip(), m.group(2).strip()
        base = s["zh"][: m.start()].rstrip()
        if not base or zh.startswith(("的", "是", "＝", "=")):
            continue  # an explanation ("écologiste 的口语"), not a phrase: stays in the gloss
        if "+" in m.group(0) and zh.startswith("不定式"):
            phrase, zh = f"{fr} + 不定式", zh[len("不定式"):].strip() or zh
        else:
            phrase = fr
        before = s["zh"]
        s["zh"] = base
        if ("+" in phrase or fold(phrase) != fold(e["lemma"])) and phrase.lower() not in have and len(e["col"]) < 5 and zh:
            e["col"].append(f"{phrase}｜{zh}")
            have.add(phrase.lower())
        out.append((before, base, f"{phrase}｜{zh}"))
    return out


def main():
    lex = json.load(open(LEX, encoding="utf-8"))
    log, merged_n, lifted_n = [], 0, 0
    for e in lex["entries"]:
        if e.get("aliasOf"):
            continue
        # notes first: a gloss that ends with its note can be matched, and merged glosses are then clean
        for before, after, col in lift_notes(e):
            lifted_n += 1
            log.append((e["id"], "note", before, f"{after} | col: {col}"))
        r = merge_senses(e)
        if r:
            e["senses"], notes = r
            merged_n += 1
            for kept, away in notes:
                log.append((e["id"], "merge", away, kept))
    print(f"entries with merged senses: {merged_n}; notes moved out of glosses: {lifted_n}; mode: {'APPLY' if APPLY else 'preview'}")
    if APPLY:
        json.dump(lex, open(LEX, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        open(LEX, "a").write("\n")
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "kind", "before", "after"])
        w.writerows(log)
    return log


if __name__ == "__main__":
    log = main()
    for row in log:
        if row[0] in ("pour", "formation", "promotion", "parattre", "quartier", "commerce", "carte", "chaine", "domaine", "vol", "argent", "entree"):
            print(" ", row)
