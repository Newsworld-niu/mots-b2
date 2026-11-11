#!/usr/bin/env python3
"""
Durable batch runner for the francais-b2 content backlog (r36).

Outcome tracking (only a real write counts as done):
  success           written to the lexicon
  rejected          model answered but the candidate failed validation
  omitted           the model did not return that id
  missing-evidence   (gloss only) dictionary lookup returned no usable entry
  transient         the batch failed before validation (network/parse/model error)

Rejected/omitted/transient/missing-evidence ids stay in a separate pending list with
their reason and are retried up to MAX_ATTEMPTS times; --reset is no longer needed to
clear history. The gloss flow first looks up real dictionary evidence and passes the
headword/pos/definition/url to the model; the writer records the cached evidence, so a
model-invented "source" is never trusted.

Usage: see scripts/runner/README.md
"""
import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LEX = os.path.join(ROOT, "data/lexicon.json")
RUN = os.path.join(ROOT, "data/lessons/runner")
PI = os.environ.get("PI_BIN", "/Users/news/.pi/agent/bin/pi")
sys.path.insert(0, os.path.join(ROOT, "scripts/runner"))
import lookup as lookup_mod  # noqa: E402

QUEUES = {"examples": os.path.join(RUN, "queue-examples.csv"), "gloss": os.path.join(RUN, "queue-gloss.csv")}
SNAP_DIR = os.path.join(ROOT, "data/snapshots")
MAX_ATTEMPTS = 3
RETRYABLE = {"rejected", "omitted", "transient", "missing-evidence"}


def state_path(q): return os.path.join(RUN, f"state-{q}.json")
def stop_path(q): return os.path.join(RUN, f"STOP-{q}")
def pending_path(q): return os.path.join(RUN, f"pending-{q}.csv")


def load_state(q):
    p = state_path(q)
    if os.path.exists(p):
        st = json.load(open(p, encoding="utf-8"))
        st.setdefault("outcomes", {})
        return st
    return {"queue": q, "outcomes": {}, "batches": 0, "applied_total": 0, "status": "idle",
            "stopReason": None, "lastError": None, "noProgressStreak": 0, "startedAt": None, "updatedAt": None}


def save_state(q, st):
    st["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    tmp = state_path(q) + ".tmp"
    json.dump(st, open(tmp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(tmp, state_path(q))


def load_queue(q):
    with open(QUEUES[q], encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_lex(): return json.load(open(LEX, encoding="utf-8"))


def atomic_write_lex(lex):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(LEX)); os.close(fd)
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(lex, f, ensure_ascii=False, indent=2)
    os.replace(tmp, LEX)


def snapshot(tag):
    os.makedirs(SNAP_DIR, exist_ok=True)
    dst = os.path.join(SNAP_DIR, f"lexicon-before-{tag}.json")
    if not os.path.exists(dst):
        shutil.copy2(LEX, dst)
    return dst


def fold(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).lower().strip()


LEAD = {"le", "la", "les", "l", "un", "une", "des", "se", "s", "du", "de", "d"}


def target_ok(lemma, fr):
    f = fold(fr)
    words = [w for w in re.split(r"[\s'’\-]+", fold(lemma)) if w and w not in LEAD and len(w) >= 3]
    if not words:
        return False
    # accept if the first content word matches, or any sufficiently long content word
    for i, w in enumerate(words):
        stem = w[:4] if len(w) > 4 else w
        if stem in f:
            return True
    return False


def extract_json(text):
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.S)
    i = min([x for x in (t.find("["), t.find("{")) if x >= 0], default=-1)
    if i < 0:
        raise ValueError("no JSON found")
    op = t[i]; cl = "]" if op == "[" else "}"
    depth = 0
    for j in range(i, len(t)):
        if t[j] == op: depth += 1
        elif t[j] == cl:
            depth -= 1
            if depth == 0:
                return json.loads(t[i:j + 1])
    raise ValueError("unbalanced JSON")


def build_prompt(queue, batch, ev=None):
    if queue == "examples":
        lines = ["You write natural, short French example sentences for a vocabulary app.",
                 "For each item write ONE French sentence using the headword (correct inflection) matching the Chinese sense, plus its accurate Chinese translation.",
                 "Rules: natural, 6-16 words, no repeated template, no new sense; omit an item if unsure.",
                 'Return ONLY a JSON array {"id","fr","zh"}. No prose, no code fence.', "", "Items:"]
        for r in batch:
            lines.append(f"- id={r['id']} | word={r['lemma']} | pos={r['pos']} | zh={r['zh']}")
        return "\n".join(lines)
    lines = ["You write concise Chinese glosses for French headwords, based ONLY on the dictionary evidence given.",
             "Each item includes a real dictionary definition and its URL. Translate/condense that sense into a short Chinese gloss.",
             'Return ONLY a JSON array {"id","zh"}. No prose, no code fence. Omit an item if the evidence is unclear.', "", "Items:"]
    for r in batch:
        e = ev[r["id"]]
        lines.append(f"- id={r['id']} | word={r['lemma']} | pos={e.get('category') or r['pos']} | definition={e['definition']} | url={e['url']}")
    return "\n".join(lines)


def run_model(prompt, timeout=900):
    proc = subprocess.run([PI, "-p", "--no-session", "--no-tools", prompt], capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"pi exit {proc.returncode}: {(proc.stderr or proc.stdout)[:200]}")
    return proc.stdout


# ---------- selection ----------

def runnable(st, q, rows):
    out = []
    for r in rows:
        o = st["outcomes"].get(r["id"])
        if o is None:
            out.append(r); continue
        if o["status"] == "success":
            continue
        if o["status"] in RETRYABLE and o.get("attempts", 0) < MAX_ATTEMPTS:
            out.append(r)
    return out


def mark(st, ids, status, reason, attempts_add=1):
    for i in ids:
        prev = st["outcomes"].get(i, {})
        st["outcomes"][i] = {"status": status, "reason": reason,
                             "attempts": prev.get("attempts", 0) + attempts_add,
                             "at": time.strftime("%Y-%m-%dT%H:%M:%S")}


# ---------- gloss evidence ----------

def gloss_evidence(batch):
    """Return {id: evidence} for items whose dictionary lookup returned a usable entry."""
    cache = json.load(open(lookup_mod.CACHE, encoding="utf-8")) if os.path.exists(lookup_mod.CACHE) else {}
    ev = {}
    for r in batch:
        w = r["lemma"]
        rec = cache.get(w) or lookup_mod.lookup(w)
        cache[w] = rec
        if rec.get("status") == "ok":
            ok = next((c for c in rec["checks"] if c.get("status") == "ok" and c.get("definition")), None)
            # a capitalised headword (proper noun) must not be matched to a lowercase homograph
            if ok and w[:1].isupper() and (ok.get("headword") or "")[:1].islower():
                ok = None
            if ok:
                ev[r["id"]] = {"headword": ok.get("headword") or w, "category": ok.get("category"),
                               "definition": ok["definition"], "url": ok["url"]}
        time.sleep(0.2)
    json.dump(cache, open(lookup_mod.CACHE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return ev


# ---------- integrity ----------

def integrity(lex):
    ids, keys = set(), set()
    for e in lex["entries"]:
        if e["id"] in ids: return f"duplicate id {e['id']}"
        ids.add(e["id"])
        if e.get("aliasOf"): continue
        k = (e["lemma"].lower(), e["pos"])
        if k in keys: return f"duplicate key {k}"
        keys.add(k)
    for e in lex["entries"]:
        if e.get("aliasOf") and e["aliasOf"] not in ids: return f"dangling alias {e['id']}"
    return None


def write_pending(q, st):
    rows = []
    for i, o in sorted(st["outcomes"].items()):
        if o["status"] != "success":
            rows.append({"id": i, "status": o["status"], "reason": o.get("reason", ""), "attempts": o.get("attempts", 0)})
    with open(pending_path(q), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id", "status", "reason", "attempts"]); w.writeheader(); w.writerows(rows)
    return len(rows)


# ---------- main loop ----------

def run_queue(queue, batch_size, max_batches):
    st = load_state(queue)
    st["status"] = "running"; st["startedAt"] = st.get("startedAt") or time.strftime("%Y-%m-%dT%H:%M:%S")
    st["stopReason"] = None; st["lastError"] = None; st["noProgressStreak"] = 0
    save_state(queue, st)
    q = load_queue(queue)
    tag = f"r36-{queue}"

    while True:
        if os.path.exists(stop_path(queue)):
            st["status"] = "stopped"; st["stopReason"] = "stop flag"; break
        pending = runnable(st, queue, q)
        if not pending:
            st["status"] = "completed"; st["stopReason"] = "no runnable items (queue exhausted or retries used up)"; break
        if max_batches and st["batches"] >= max_batches:
            st["status"] = "paused"; st["stopReason"] = f"max-batches {max_batches}"; break
        batch = pending[:batch_size]
        st["batches"] += 1
        print(f"[batch {st['batches']}] {queue}: {len(batch)} items", flush=True)

        ev = None
        if queue == "gloss":
            ev = gloss_evidence(batch)
            noev = [r["id"] for r in batch if r["id"] not in ev]
            if noev:
                mark(st, noev, "missing-evidence", "dictionary lookup returned no usable entry")
            batch = [r for r in batch if r["id"] in ev]
            if not batch:
                print("  no items with evidence", flush=True)
                save_state(queue, st)
                continue

        try:
            raw = run_model(build_prompt(queue, batch, ev))
            cands = extract_json(raw)
            if not isinstance(cands, list):
                raise ValueError("model did not return a JSON array")
        except Exception as e:
            err = str(e)[:200]
            print(f"  ERROR {err}", flush=True)
            mark(st, [r["id"] for r in batch], "transient", err)
            if err == st.get("lastError"):
                st["status"] = "stopped"; st["stopReason"] = "same error twice"; st["lastError"] = err
                break
            st["lastError"] = err
            save_state(queue, st)
            continue

        lex = load_lex()
        snapshot(tag)
        by = {e["id"]: e for e in lex["entries"]}
        applied, rejected, answered = [], [], set()
        for c in cands:
            if not isinstance(c, dict):
                continue
            eid = str(c.get("id", "")); answered.add(eid)
            e = by.get(eid)
            if not e or e.get("aliasOf"):
                rejected.append((eid, "unknown/alias")); continue
            if queue == "examples":
                fr = str(c.get("fr", "")).strip(); zh = str(c.get("zh", "")).strip()
                if e.get("examples"): rejected.append((eid, "already has example")); continue
                if not (6 <= len(fr) <= 200) or not zh: rejected.append((eid, "bad length/empty zh")); continue
                if not target_ok(e["lemma"], fr): rejected.append((eid, "target word not found in sentence")); continue
                e["examples"] = [{"fr": fr, "zh": zh, "origin": "supplement"}]
                e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") +
                             f"{tag} 例句为本站补充（教材无对应例句），译文同为补充。").strip()
                applied.append(eid)
            else:
                zh = str(c.get("zh", "")).strip()
                if any(s.get("zh", "").strip() for s in e.get("senses", [])): rejected.append((eid, "already has gloss")); continue
                if not zh or len(zh) > 60: rejected.append((eid, "bad zh")); continue
                info = ev.get(eid)
                if not info: rejected.append((eid, "no cached evidence")); continue
                e["senses"] = [{"zh": "", "fr": "", "origin": "book"},
                               {"zh": zh, "fr": "", "origin": "supplement", "status": "补充翻译·待核对"}]
                e["note"] = ((e.get("note") or "") + ("；" if (e.get("note") or "").strip() else "") +
                             f"{tag} 释义来源：{info['url']}（{info['headword']}；{info['definition'][:120]}）；中文为补充翻译·待核对。").strip()
                applied.append(eid)
        problem = integrity(lex)
        if problem:
            st["status"] = "stopped"; st["stopReason"] = f"integrity: {problem}"; break
        atomic_write_lex(lex)
        mark(st, applied, "success", "")
        mark(st, [i for i, _ in rejected], "rejected", "; ".join(f"{i}:{r}" for i, r in rejected)[:200])
        omitted = [r["id"] for r in batch if r["id"] not in answered]
        if omitted:
            mark(st, omitted, "omitted", "model did not return this id")
        st["applied_total"] += len(applied)
        st["noProgressStreak"] = st["noProgressStreak"] + 1 if not applied else 0
        logp = os.path.join(ROOT, "output", f"{tag}-batch{st['batches']}.csv")
        with open(logp, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f); w.writerow(["id", "status", "reason"])
            for i in applied: w.writerow([i, "success", ""])
            for i, r in rejected: w.writerow([i, "rejected", r])
            for i in omitted: w.writerow([i, "omitted", ""])
        n = write_pending(queue, st)
        print(f"  success={len(applied)} rejected={len(rejected)} omitted={len(omitted)} total={st['applied_total']} pending={n}", flush=True)
        save_state(queue, st)
        if st["noProgressStreak"] >= 2:
            st["status"] = "stopped"; st["stopReason"] = "two batches with no progress"; break
    write_pending(queue, st)
    save_state(queue, st)
    print(f"STOP {st['status']}: {st['stopReason']} | batches={st['batches']} applied={st['applied_total']}")
    return 0 if st["status"] in ("completed", "paused") else 1


def status(queue):
    st = load_state(queue)
    q = load_queue(queue)
    from collections import Counter
    c = Counter(o["status"] for o in st["outcomes"].values())
    print(json.dumps({"queue_total": len(q), "batches": st["batches"], "applied_total": st["applied_total"],
                      "status": st["status"], "stopReason": st["stopReason"], "outcomes": dict(c),
                      "pending": sum(1 for o in st["outcomes"].values() if o["status"] != "success"),
                      "untried": sum(1 for r in q if r["id"] not in st["outcomes"])}, ensure_ascii=False, indent=1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--queue", choices=["examples", "gloss"], default="examples")
    ap.add_argument("--batch-size", type=int, default=50)
    ap.add_argument("--max-batches", type=int, default=0)
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--stop", action="store_true")
    ap.add_argument("--reset", action="store_true")
    a = ap.parse_args()
    if a.status: status(a.queue); return
    if a.stop: open(stop_path(a.queue), "w").write("stop\n"); print("stop flag written"); return
    if a.reset:
        for p in (state_path(a.queue), stop_path(a.queue)):
            if os.path.exists(p): os.remove(p)
        print("reset"); return
    if os.path.exists(stop_path(a.queue)):
        print("stop flag present; remove it to run"); return
    sys.exit(run_queue(a.queue, a.batch_size, a.max_batches))


if __name__ == "__main__":
    main()
