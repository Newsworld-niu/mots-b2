"""Recorded pronunciations for the atlas: every headword and example, in a female and a male voice.

Azure Speech (REST) reads each text once and writes public/atlas/audio/<kind>/<id>.mp3:
  f / m          headword, female (fr-FR-DeniseNeural) / male (fr-FR-HenriNeural)
  ex-f / ex-m    first example
  ex2-f / ex2-m  second example
scripts/build-atlas.ts marks an entry's audio as present from these files.

Resumable: data/audio-manifest.json records the spoken text of every file, so a rerun skips what is done
and remakes a file only when its text changed (an edited example). It stops on its own when Azure refuses
for quota (free tier: a monthly character allowance); run it again next month.

Key and region come from .env.local (AZURE_SPEECH_KEY, AZURE_SPEECH_REGION); it is git-ignored.

  python3 -I scripts/build-audio.py --dry-run            # what would be read, and how many characters
  python3 -I scripts/build-audio.py --only f,m --limit 20
  python3 -I scripts/build-audio.py                      # everything still missing, words first
"""
import argparse
import glob
import hashlib
import html
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIO = os.path.join(ROOT, "public", "atlas", "audio")
MANIFEST = os.path.join(ROOT, "data", "audio-manifest.json")
VOICES = {"f": "fr-FR-DeniseNeural", "m": "fr-FR-HenriNeural"}
# Order matters when the allowance runs out: every headword (both voices) before any example.
KINDS = ["f", "m", "ex-f", "ex-m", "ex2-f", "ex2-m"]
FORMAT = "audio-24khz-48kbitrate-mono-mp3"
SILENCE = '<mstts:silence type="Leading-exact" value="50ms"/><mstts:silence type="Tailing-exact" value="150ms"/>'

ABBR = {
    r"\bqqn\b": "quelqu'un",
    r"\bqn\b": "quelqu'un",
    r"\bqqch\b": "quelque chose",
    r"\bqc\b": "quelque chose",
}


def spoken(text: str) -> str:
    """The text as it should be read aloud: no reader's glosses, alternatives read with "ou"."""
    t = _spoken(text)
    # an "example" that is only a bracketed list, "(bus, métro, tramway, train)": read what is inside
    # (what is left may be just the closing ".", so look for a letter, not for an empty string)
    return t if re.search(r"\w", t) else _spoken(re.sub(r"[()]", "", text))


def _spoken(text: str) -> str:
    t = text
    # glosses and notes in brackets: "posé (= mis)", "(≠ derrière vous)", "(finalement)", "marié(e)"
    for _ in range(2):  # nested brackets are rare; two passes cover them
        t = re.sub(r"\s*\([^()]*\)", "", t)
    for pat, rep in ABBR.items():
        t = re.sub(pat, rep, t)
    # "un message? / Vous voulez …": two sentences offered as alternatives, read one after the other
    t = re.sub(r"([?!.…])\s*/\s*", r"\1 ", t)
    # "regarde/lis", "ton / votre": alternatives; a date such as 28/09/60 keeps its slashes
    t = re.sub(r"(?<!\d)\s*/\s*(?!\d)", " ou ", t)
    t = re.sub(r"\s+([,.;:!?])", lambda m: m.group(1) if m.group(1) in ",." else " " + m.group(1), t)
    t = t.replace(" = ", ", ")  # "habitation à loyer modéré = des logements sociaux"
    t = re.sub(r"\s+", " ", t).strip()
    return t


def texts_by_kind() -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {k: {} for k in KINDS}
    for f in sorted(glob.glob(os.path.join(ROOT, "public", "atlas", "entries", "*.json")), key=lambda p: int(os.path.basename(p)[:-5])):
        for e in json.load(open(f, encoding="utf-8")):
            word = spoken(e["w"])
            if word:
                out["f"][e["id"]] = out["m"][e["id"]] = word
            for i, kind in enumerate(["ex", "ex2"]):
                if len(e.get("ex", [])) > i:
                    s = spoken(e["ex"][i]["en"])
                    if s:
                        out[f"{kind}-f"][e["id"]] = out[f"{kind}-m"][e["id"]] = s
    return out


def load_env() -> tuple[str, str]:
    env = {}
    path = os.path.join(ROOT, ".env.local")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            k, _, v = line.strip().partition("=")
            if k and not k.startswith("#"):
                env[k] = v.strip().strip('"')
    key = os.environ.get("AZURE_SPEECH_KEY") or env.get("AZURE_SPEECH_KEY")
    region = os.environ.get("AZURE_SPEECH_REGION") or env.get("AZURE_SPEECH_REGION")
    if not key or not region:
        sys.exit("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION missing: put them in francais-b2/.env.local")
    return key, region


class QuotaExhausted(Exception):
    pass


def synth(key: str, region: str, voice: str, text: str) -> bytes:
    # Azure pads every clip with about a second of silence; trimmed, a word starts as soon as it is tapped
    ssml = (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="fr-FR">'
        f'<voice name="{voice}">{SILENCE}{html.escape(text)}</voice></speak>'
    )
    req = urllib.request.Request(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": FORMAT,
            "User-Agent": "word-atlas-build-audio",
        },
    )
    delay = 5.0
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 500:
                raise RuntimeError(f"suspiciously short audio ({len(data)} bytes)")
            return data
        except urllib.error.HTTPError as err:
            body = err.read()[:300].decode("utf-8", "replace")
            if err.code in (401, 403):
                # the free tier answers 403 once the monthly allowance is spent
                raise QuotaExhausted(f"HTTP {err.code}: {body or err.reason}")
            if err.code == 429 or err.code >= 500:
                wait = float(err.headers.get("Retry-After") or delay)
                time.sleep(min(wait, 120))
                delay = min(delay * 2, 120)
                continue
            raise RuntimeError(f"HTTP {err.code}: {body or err.reason}")
        except (urllib.error.URLError, TimeoutError):
            time.sleep(delay)
            delay = min(delay * 2, 120)
    raise QuotaExhausted("Azure kept refusing (HTTP 429) for several minutes: the allowance is probably spent")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="comma-separated kinds: " + ",".join(KINDS))
    ap.add_argument("--limit", type=int, default=0, help="stop after this many new files")
    ap.add_argument("--max-chars", type=int, default=0, help="stop before sending more than this many characters")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    kinds = a.only.split(",") if a.only else KINDS
    for k in kinds:
        if k not in KINDS:
            sys.exit(f"unknown kind {k}")
    texts = texts_by_kind()
    manifest: dict[str, dict[str, str]] = json.load(open(MANIFEST, encoding="utf-8")) if os.path.exists(MANIFEST) else {}
    manifest.setdefault("_", {"voices": VOICES, "format": FORMAT, "silence": SILENCE})  # type: ignore[arg-type]

    def h(t: str) -> str:
        return hashlib.sha1(t.encode("utf-8")).hexdigest()[:12]

    todo: list[tuple[str, str, str]] = []
    stale = 0
    for k in kinds:
        done = manifest.get(k, {})
        for id_, t in texts[k].items():
            path = os.path.join(AUDIO, k, f"{id_}.mp3")
            if done.get(id_) == h(t) and os.path.exists(path):
                continue
            if id_ in done:
                stale += 1
            todo.append((k, id_, t))
    total_chars = sum(len(t) for _, _, t in todo)
    print(f"to make: {len(todo)} files, {total_chars} characters ({stale} because their text changed)")
    for k in kinds:
        n = [x for x in todo if x[0] == k]
        print(f"  {k:6} {len(n):5} files  {sum(len(t) for *_, t in n):7} chars")
    if a.dry_run:
        return

    key, region = load_env()
    if a.limit:
        todo = todo[: a.limit]
    if a.max_chars:
        kept, n = [], 0
        for item in todo:
            if n + len(item[2]) > a.max_chars:
                break
            kept.append(item)
            n += len(item[2])
        todo = kept

    lock = threading.Lock()
    stop = threading.Event()
    made = sent = failed = 0
    reason = ""

    def save_manifest() -> None:
        tmp = MANIFEST + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        os.replace(tmp, MANIFEST)

    def work(item: tuple[str, str, str]) -> None:
        nonlocal made, sent, failed, reason
        k, id_, t = item
        if stop.is_set():
            return
        try:
            data = synth(key, region, VOICES[k.split("-")[-1]], t)
        except QuotaExhausted as err:
            with lock:
                reason = str(err)
            stop.set()
            return
        except Exception as err:  # one bad text should not stop the batch
            with lock:
                failed += 1
                print(f"  failed {k}/{id_}: {err}", flush=True)
            return
        os.makedirs(os.path.join(AUDIO, k), exist_ok=True)
        path = os.path.join(AUDIO, k, f"{id_}.mp3")
        with open(path + ".part", "wb") as f:
            f.write(data)
        os.replace(path + ".part", path)
        with lock:
            manifest.setdefault(k, {})[id_] = h(t)
            made += 1
            sent += len(t)
            if made % 50 == 0:
                save_manifest()
                print(f"  {made}/{len(todo)} files, {sent} chars", flush=True)

    start = time.time()
    try:
        with ThreadPoolExecutor(max_workers=a.workers) as pool:
            list(pool.map(work, todo))
    finally:
        save_manifest()
    mins = (time.time() - start) / 60
    print(f"made {made} files, sent {sent} characters, {failed} failed, in {mins:.1f} min")
    if reason:
        print(f"stopped early: {reason}")
        print("run the same command again later (next month for the free tier); finished files are kept")
        sys.exit(2)


if __name__ == "__main__":
    main()
