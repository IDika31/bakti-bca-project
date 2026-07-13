#!/usr/bin/env bash
# Run backend (Hono/Bun) + frontend (Next.js) concurrently.
# Usage: ./dev.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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
echo "[dev] Ctrl+C to stop both."

wait
