#!/usr/bin/env python3
"""Split the catch-all "society" topic (≈1,500 words) by the textbook chapter each word came from.

The first source whose chapter matches a rule decides; words with no matching chapter stay in "society".
Writes data/lexicon.json in place and a log to output/split-society-topic.csv. Idempotent.
"""
import csv, json, re, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEX = ROOT / "data/lexicon.json"
LOG = ROOT / "output/split-society-topic.csv"

def fold(s):
    s = unicodedata.normalize("NFD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()

# (pattern on the folded chapter, topic). Order matters: the first match wins.
RULES = [
    (r"maison|logement|ville|campagne|directions", "city"),
    (r"geographie|francophonie|histoire", "history"),
    (r"politique|societe|diversite|crime|faits divers|administration|poste", "government"),
    (r"connecteur|opinion|appreciation|debat|changements et progres", "thinking"),
    (r"art|culture|loisir|spectacle", "arts"),
    (r"famille|relation|sentiment|periodes de la vie|apparence|usages|politesse|presentations", "people"),
    (r"activites quotidiennes", "daily"),
    (r"profession|education, le travail", "work"),
    (r"commerce|faire les courses", "economy"),
    (r"enseignement", "education"),
    (r"environnement|nature", "environment"),
    (r"transports", "travel"),
]

def topic_for(entry):
    for s in entry.get("sources", []):
        ch = fold(s.get("chapter", ""))
        for pat, topic in RULES:
            if re.search(pat, ch):
                return topic, s.get("chapter", "")
    return None, ""

def main():
    data = json.loads(LEX.read_text("utf8"))
    rows, moved = [], 0
    for e in data["entries"]:
        if e.get("topic") != "society":
            continue
        t, ch = topic_for(e)
        if t:
            e["topic"] = t
            moved += 1
        rows.append([e["id"], e.get("lemma", ""), t or "society", ch])
    LEX.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", "utf8")
    LOG.parent.mkdir(exist_ok=True)
    with LOG.open("w", newline="", encoding="utf8") as f:
        w = csv.writer(f)
        w.writerow(["id", "lemma", "topic", "chapter"])
        w.writerows(rows)
    print(f"moved {moved} of {len(rows)} society entries; log: {LOG.relative_to(ROOT)}")

if __name__ == "__main__":
    sys.exit(main())
