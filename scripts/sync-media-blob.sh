#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f server/.deploy.env ]; then
  # shellcheck disable=SC1091
  set -a
  source server/.deploy.env
  set +a
fi

DRY_RUN=0
SETUP=0
ONLY="all"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --setup) SETUP=1 ;;
    --only=*) ONLY="${arg#--only=}" ;;
    *)
      echo "Unknown option: $arg" >&2
      echo "Usage: $0 [--dry-run] [--setup] [--only=materials|audio|all]" >&2
      exit 1
      ;;
  esac
done

case "$ONLY" in
  all|materials|audio) ;;
  *)
    echo "Invalid --only value: $ONLY (expected materials|audio|all)" >&2
    exit 1
    ;;
esac

RG="${RG:-mots-b2-sync}"
LOCATION="${LOCATION:-japaneast}"
SUFFIX="${SUFFIX:-}"
MEDIA_SA="${MEDIA_SA:-motsb2media${SUFFIX}}"
if [ -z "$MEDIA_SA" ]; then
  echo "MEDIA_SA or SUFFIX must be configured in server/.deploy.env or environment." >&2
  exit 1
fi
MEDIA_BASE_URL="${MEDIA_BASE_URL:-https://${MEDIA_SA}.blob.core.windows.net/media}"

stats_for() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    echo "0 0.0"
    return
  fi
  python3 - "$dir" <<'PY'
import os, sys
root = sys.argv[1]
count = 0
total = 0
for cur, _, files in os.walk(root):
    for fn in files:
        if fn.lower().endswith(".mp3"):
            count += 1
            total += os.path.getsize(os.path.join(cur, fn))
print(f"{count} {total / (1024 * 1024):.1f}")
PY
}

read -r AUDIO_COUNT AUDIO_MB < <(stats_for "public/atlas/audio")
read -r RFI_COUNT RFI_MB < <(stats_for "public/materials/rfi")
read -r CO_COUNT CO_MB < <(stats_for "public/materials/co")

echo "[media:sync] RG=${RG} MEDIA_SA=${MEDIA_SA} MEDIA_BASE_URL=${MEDIA_BASE_URL}"
echo "[media:sync] Local audio inventory:"
echo "  - public/atlas/audio:    ${AUDIO_COUNT} MP3s (${AUDIO_MB} MB)"
echo "  - public/materials/rfi:  ${RFI_COUNT} MP3s (${RFI_MB} MB)"
echo "  - public/materials/co:   ${CO_COUNT} MP3s (${CO_MB} MB)"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "[media:sync] --dry-run enabled (0 cloud mutations). Planned sync commands:"
  if [ "$SETUP" -eq 1 ]; then
    echo "  az storage account create -n ${MEDIA_SA} -g ${RG} -l ${LOCATION} --sku Standard_LRS --kind StorageV2 --allow-blob-public-access true --min-tls-version TLS1_2"
    echo "  az storage container create -n media --public-access blob"
  fi
  if [ "$ONLY" = "all" ] || [ "$ONLY" = "audio" ]; then
    echo "  az storage blob sync -c media -s public/atlas/audio -d atlas/audio --exclude-pattern '*.DS_Store' --delete-destination false -- --cache-control 'public, max-age=31536000, immutable'"
    echo "  az storage blob upload-batch -d media --destination-path atlas/audio -s public/atlas/audio --pattern '*.mp3' --overwrite false --content-cache-control 'public, max-age=31536000, immutable' --content-type 'audio/mpeg'"
  fi
  if [ "$ONLY" = "all" ] || [ "$ONLY" = "materials" ]; then
    if [ -d public/materials/co ]; then
      echo "  az storage blob sync -c media -s public/materials/co -d materials/co --exclude-pattern '*.DS_Store' --delete-destination false -- --cache-control 'public, max-age=31536000, immutable'"
      echo "  az storage blob upload-batch -d media --destination-path materials/co -s public/materials/co --pattern '*.mp3' --overwrite false --content-cache-control 'public, max-age=31536000, immutable' --content-type 'audio/mpeg'"
    fi
    if [ -d public/materials/rfi ]; then
      echo "  az storage blob sync -c media -s public/materials/rfi -d materials/rfi --include-pattern '*.mp3' --exclude-pattern '*.DS_Store;*.txt;*.segments.json' --delete-destination false -- --cache-control 'public, max-age=31536000, immutable'"
      echo "  az storage blob upload-batch -d media --destination-path materials/rfi -s public/materials/rfi --pattern '*.mp3' --overwrite false --content-cache-control 'public, max-age=31536000, immutable' --content-type 'audio/mpeg'"
    fi
  fi
  exit 0
fi

if [ "$SETUP" -eq 1 ]; then
  az group create -n "$RG" -l "$LOCATION" -o none
  if ! az storage account show -n "$MEDIA_SA" -g "$RG" -o none 2>/dev/null; then
    az storage account create \
      -n "$MEDIA_SA" \
      -g "$RG" \
      -l "$LOCATION" \
      --sku Standard_LRS \
      --kind StorageV2 \
      --allow-blob-public-access true \
      --min-tls-version TLS1_2 \
      -o none
  fi
fi

MEDIA_CONN="$(az storage account show-connection-string -n "$MEDIA_SA" -g "$RG" --query connectionString -o tsv)"
if [ "$SETUP" -eq 1 ]; then
  az storage container create -n media --connection-string "$MEDIA_CONN" --public-access blob -o none
  az storage cors clear --services b --connection-string "$MEDIA_CONN" -o none 2>/dev/null || true
  az storage cors add \
    --services b \
    --methods GET HEAD OPTIONS \
    --origins "https://newsworld-niu.github.io" "http://127.0.0.1:5190" "http://localhost:5190" "http://127.0.0.1:5188" "http://127.0.0.1:5191" \
    --allowed-headers "*" \
    --exposed-headers Content-Length Content-Range Accept-Ranges ETag \
    --max-age 86400 \
    --connection-string "$MEDIA_CONN" \
    -o none
fi

upload_dir() {
  local src="$1"
  local dest="$2"
  local pattern="$3"
  [ -d "$src" ] || return 0
  if command -v azcopy >/dev/null 2>&1; then
    az storage blob sync \
      -c media \
      -s "$src" \
      -d "$dest" \
      --include-pattern "$pattern" \
      --exclude-pattern '*.DS_Store;*.txt;*.segments.json' \
      --delete-destination false \
      --connection-string "$MEDIA_CONN"
  fi
  az storage blob upload-batch \
    -d media \
    --destination-path "$dest" \
    -s "$src" \
    --pattern "$pattern" \
    --overwrite false \
    --max-connections 16 \
    --content-cache-control "public, max-age=31536000, immutable" \
    --content-type "audio/mpeg" \
    --connection-string "$MEDIA_CONN" \
    --no-progress || true
}

if [ "$ONLY" = "all" ] || [ "$ONLY" = "audio" ]; then
  upload_dir "public/atlas/audio" "atlas/audio" "*.mp3"
fi
if [ "$ONLY" = "all" ] || [ "$ONLY" = "materials" ]; then
  upload_dir "public/materials/co" "materials/co" "*.mp3"
  upload_dir "public/materials/rfi" "materials/rfi" "*.mp3"
fi

echo "[media:sync] Done. Frontend build env: VITE_MEDIA_BASE_URL=${MEDIA_BASE_URL}"
