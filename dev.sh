#!/usr/bin/env bash
# Run backend (Hono/Bun) + frontend (Next.js) concurrently.
# Usage:
#   ./dev.sh            — backend + frontend only
#   ./dev.sh --mobile   — backend + frontend + ADB reverse + Capacitor run on device

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE=false
[[ "${1:-}" == "--mobile" || "${1:-}" == "-m" ]] && MOBILE=true

cleanup() {
  echo ""
  echo "[dev] Stopping..."
  [[ -n "${BACKEND_PID:-}" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "[dev] Starting backend (bun) ..."
(cd "$ROOT/backend" && bun run dev) &
BACKEND_PID=$!

echo "[dev] Starting frontend (next) ..."
(cd "$ROOT/frontend" && bun run dev) &
FRONTEND_PID=$!

echo "[dev] backend PID=$BACKEND_PID  frontend PID=$FRONTEND_PID"

if $MOBILE; then
  echo ""
  echo "[dev] Mobile mode — setting up ADB + Capacitor..."
  echo "[dev] Waiting 5s for servers to start..."
  sleep 5

  echo "[dev] Setting up ADB reverse port forwarding..."
  adb reverse tcp:3000 tcp:3000
  adb reverse tcp:3001 tcp:3001
  echo "[dev] Ports 3000 + 3001 forwarded to device."

  echo "[dev] Syncing and running Capacitor on device..."
  (cd "$ROOT/mobile" && npm install && npx cap sync android && npx cap run android) &
  echo ""
  echo "[dev] App deploying to device. Ctrl+C to stop all."
else
  echo "[dev] Ctrl+C to stop both."
  echo "[dev] Tip: use ./dev.sh --mobile to also deploy to Android device via ADB."
fi

wait
