#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SUB="0acc3715-9b32-445b-9fa4-00a2f8308470"
RG="mots-b2-sync"
LOCATION="japaneast"

if [ -f .deploy.env ]; then
  # shellcheck disable=SC1091
  set -a
  source .deploy.env
  set +a
fi

if [ -z "${SUFFIX:-}" ]; then
  SUFFIX="$(openssl rand -hex 3)"
  printf 'SUFFIX=%s\n' "$SUFFIX" > .deploy.env
fi

SA="motsb2sync${SUFFIX}"
APP="mots-b2-sync-${SUFFIX}"

az account set --subscription "$SUB"
az group create -n "$RG" -l "$LOCATION" -o none

if ! az storage account show -n "$SA" -g "$RG" -o none 2>/dev/null; then
  az storage account create \
    -n "$SA" \
    -g "$RG" \
    -l "$LOCATION" \
    --sku Standard_LRS \
    --kind StorageV2 \
    --allow-blob-public-access false \
    --min-tls-version TLS1_2 \
    -o none
fi

CONN="$(az storage account show-connection-string -n "$SA" -g "$RG" --query connectionString -o tsv)"
az storage container create -n sync --connection-string "$CONN" --public-access off -o none

if ! az functionapp show -n "$APP" -g "$RG" -o none 2>/dev/null; then
  CREATE_ARGS=(
    -g "$RG"
    -n "$APP"
    --storage-account "$SA"
    --flexconsumption-location "$LOCATION"
    --runtime node
    --runtime-version 22
    -o none
  )
  if az functionapp create --help 2>&1 | grep -q -- '--disable-app-insights'; then
    CREATE_ARGS+=(--disable-app-insights)
  fi
  az functionapp create "${CREATE_ARGS[@]}"
fi

if [ ! -f .admin-key ]; then
  openssl rand -hex 32 > .admin-key
fi
chmod 600 .admin-key

ADMIN_KEY_VAL="$(tr -d '\r\n' < .admin-key)"
ALLOWED_ORIGINS="https://newsworld-niu.github.io,http://127.0.0.1:5190,http://localhost:5190,http://127.0.0.1:5188,https://localhost,capacitor://localhost"

az functionapp config appsettings set \
  -g "$RG" \
  -n "$APP" \
  --settings \
    SYNC_STORAGE_CONNECTION="$CONN" \
    ADMIN_KEY="$ADMIN_KEY_VAL" \
    ALLOWED_ORIGINS="$ALLOWED_ORIGINS" \
  -o none

REQUIRED_ORIGINS=(
  "https://newsworld-niu.github.io"
  "http://127.0.0.1:5190"
  "http://localhost:5190"
  "http://127.0.0.1:5188"
  "https://localhost"
  "capacitor://localhost"
)
EXISTING_CORS="$(az functionapp cors show -g "$RG" -n "$APP" --query "allowedOrigins" -o tsv 2>/dev/null || true)"
MISSING_ORIGINS=()
for origin in "${REQUIRED_ORIGINS[@]}"; do
  if ! printf '%s\n' "$EXISTING_CORS" | grep -Fxq "$origin"; then
    MISSING_ORIGINS+=("$origin")
  fi
done
if [ "${#MISSING_ORIGINS[@]}" -gt 0 ]; then
  az functionapp cors add -g "$RG" -n "$APP" --allowed-origins "${MISSING_ORIGINS[@]}" -o none
fi

HOST="$(az functionapp show -g "$RG" -n "$APP" --query "defaultHostName || properties.defaultHostName" -o tsv)"
SYNC_URL="https://${HOST}"

cat > .deploy.env <<EOF
SUFFIX=${SUFFIX}
RG=${RG}
LOCATION=${LOCATION}
SA=${SA}
APP=${APP}
SYNC_URL=${SYNC_URL}
EOF

npm run build
FUNCTIONS_CORE_TOOLS_TELEMETRY_OPTOUT=1 func azure functionapp publish "$APP" --build remote

echo "SYNC_URL=${SYNC_URL}"
