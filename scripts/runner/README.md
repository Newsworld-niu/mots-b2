# Content batch runner

Recoverable, single-writer runner for the francais-b2 content backlog. It reads a
fixed-ID queue, skips attempted items, and processes one batch at a time by launching
a fresh short-context `pi -p` process (no tools, no session). The model returns JSON
candidates; the runner validates them and is the only writer (atomic replace +
snapshot + per-batch log). It auto-advances to the next batch and stops on:
queue exhausted, `--max-batches`, stop flag, two consecutive batches with no progress,
or the same error twice.

## Files
- Queues: `data/lessons/runner/queue-examples.csv`, `queue-gloss.csv`
- State: `data/lessons/runner/state-<queue>.json`
- Stop flag: `data/lessons/runner/STOP-<queue>`
- Logs: `output/r35-<queue>-batchN.csv`; snapshots `data/snapshots/lexicon-before-r35-<queue>.json`

## Commands
```bash
# run the example queue, 50 per batch, 2 batches then stop
python3 scripts/runner/run-batch.py --queue examples --batch-size 50 --max-batches 2
# process gloss candidates
python3 scripts/runner/run-batch.py --queue gloss --batch-size 50
# progress
python3 scripts/runner/run-batch.py --status
# graceful stop (checked between batches; safe resume with the same command)
python3 scripts/runner/run-batch.py --stop
# clear state + stop flag to start over
python3 scripts/runner/run-batch.py --reset
```
Run with no `--max-batches` to process until the queue is exhausted or a stop
condition fires. Re-running the same command resumes (attempted IDs are skipped).
Model and credentials come from the default `pi` configuration (`PI_BIN`, default
`/Users/news/.pi/agent/bin/pi`).

## Dictionary lookup
`python3 scripts/runner/lookup.py <word> ...` classifies each query as
ok / network_error / rate_limited / parse_error / headword_mismatch / no_entry and
caches URL + headword + definition in `data/dictionary/runner-lookup.json`. The gloss
queue requires the model to cite a source, so a candidate without evidence is rejected.

## Outcome tracking (r36)
Each id in `state-<queue>.json` has `outcomes[id] = {status, reason, attempts, at}` with status
`success | rejected | omitted | missing-evidence | transient`. Only `success` counts as done.
`data/lessons/runner/pending-<queue>.csv` lists every non-success id with its reason and attempt
count. Rejected/omitted/transient/missing-evidence items are retried up to 3 attempts.

## Gloss evidence (r36)
`--queue gloss` first reads `scripts/runner/lookup.py` and passes the real headword/pos/
definition/url to the model. The writer records the **cached** evidence (not a model-supplied
source) and rejects a candidate when the lookup returned no usable entry. A capitalised headword
(proper noun) is not matched to a lowercase homograph (this caught `Chili` country vs `chili`
pepper); proper nouns are kept in `data/lessons/runner/queue-gloss-proper.csv`.
