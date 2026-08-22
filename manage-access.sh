#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JS="$SCRIPT_DIR/manage-access.js"
VOLUME="kalkulator-harga-shopee_sqlite_data"
IMAGE="node:22-slim"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker tidak ditemukan di sistem ini." >&2
  exit 1
fi

mount_args=()
if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  mount_args=(-v "$VOLUME:/data")
elif [[ -f "$SCRIPT_DIR/backend/data/shopee_calculator.db" ]]; then
  mount_args=(-v "$SCRIPT_DIR/backend/data/shopee_calculator.db:/data/shopee_calculator.db")
else
  echo "Error: database tidak ditemukan." >&2
  echo "Cari di: docker volume '$VOLUME' atau '$SCRIPT_DIR/backend/data/shopee_calculator.db'" >&2
  exit 1
fi

tty_flags=(-i)
if [[ -t 0 ]]; then
  tty_flags=(-it)
fi

exec docker run --rm "${tty_flags[@]}" \
  -v "$JS:/app/manage-access.js:ro" \
  "${mount_args[@]}" \
  -e MANAGE_DB=/data/shopee_calculator.db \
  "$IMAGE" node /app/manage-access.js "$@"
