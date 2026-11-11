#!/usr/bin/env bash
# usage: run-batch.sh <batch-name>   (expects data/imports/<name>-fill.csv)
# snapshot → dry-run → import → check → build → ids → test. Logs under output/<name>/. Prints one summary line.
set -u
cd "$(dirname "$0")/../../.."
N="$1"; F="data/imports/${N}-fill.csv"; D="output/${N}"; mkdir -p "$D"
S="data/snapshots/lexicon-before-${N}.json"
[ -f "$S" ] || cp data/lexicon.json "$S"
before=$(python3 -c "import json;print(len(json.load(open('data/lexicon.json'))['entries']))")
npm run -s lexicon:import -- "$F" --dry-run > "$D/dryrun.log" 2>&1 || { echo "DRYRUN FAILED ($N) see $D/dryrun.log"; exit 1; }
if grep -q "含错误" "$D/dryrun.log"; then echo "REJECTED ($N): errors, see $D/dryrun.log"; exit 1; fi
npm run -s lexicon:import -- "$F" > "$D/import.log" 2>&1 || { echo "IMPORT FAILED ($N)"; exit 1; }
npm run -s lexicon:check > "$D/check.log" 2>&1 || { echo "CHECK FAILED ($N) see $D/check.log"; exit 1; }
npm run -s lexicon:build > "$D/build.log" 2>&1 || { echo "BUILD FAILED"; exit 1; }
npm run -s lexicon:ids > "$D/ids.log" 2>&1 || { echo "ID CHECK FAILED ($N)"; exit 1; }
after=$(python3 -c "import json;print(len(json.load(open('data/lexicon.json'))['entries']))")
summ=$(grep -E "^rows=" "$D/import.log")
[ -z "$summ" ] && summ="(already imported earlier; see data/import-log.jsonl)"
learn=$(python3 -c "import json;w=json.load(open('public/atlas/index.json'))['words'];print(sum(1 for x in w if x[2]!='释义待补充'), len(w))")
echo "OK $N | $summ | entries ${before} to ${after} | learnable/visible: $learn | ids ok"
