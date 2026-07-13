# Run backend (Hono/Bun) + frontend (Next.js) concurrently.
# Usage: .\dev.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$backend = Start-Process -FilePath "bun" -ArgumentList "run","dev" `
  -WorkingDirectory (Join-Path $root "backend") -NoNewWindow -PassThru

$frontend = Start-Process -FilePath "bun" -ArgumentList "run","dev" `
  -WorkingDirectory (Join-Path $root "frontend") -NoNewWindow -PassThru

Write-Host "[dev] backend PID=$($backend.Id)  frontend PID=$($frontend.Id)"
Write-Host "[dev] Ctrl+C to stop both."

try {
  Wait-Process -Id $backend.Id, $frontend.Id
} finally {
  Write-Host "`n[dev] Stopping..."
  if (-not $backend.HasExited)  { try { Stop-Process -Id $backend.Id  -Force -ErrorAction Stop } catch {} }
  if (-not $frontend.HasExited) { try { Stop-Process -Id $frontend.Id -Force -ErrorAction Stop } catch {} }
}
