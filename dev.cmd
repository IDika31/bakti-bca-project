@echo off
REM Run backend (Hono/Bun) + frontend (Next.js) concurrently.
REM Usage:
REM   dev.cmd            — backend + frontend only
REM   dev.cmd --mobile   — backend + frontend + ADB reverse + Capacitor run

setlocal

if "%1"=="--mobile" goto mobile
if "%1"=="-m" goto mobile

echo [dev] Starting backend + frontend...
echo [dev] Ctrl+C to stop.
echo.

start "backend" cmd /c "cd backend && bun run dev"
start "frontend" cmd /c "cd frontend && bun run dev"

echo [dev] backend and frontend started in separate windows.
echo [dev] Tip: use dev.cmd --mobile to also deploy to Android device via ADB.
goto end

:mobile
echo [dev] Starting backend + frontend + mobile...
echo.

start "backend" cmd /c "cd backend && bun run dev"
start "frontend" cmd /c "cd frontend && bun run dev"

echo [dev] Waiting 5s for servers to start...
timeout /t 5 /nobreak >nul

echo [dev] Setting up ADB reverse port forwarding...
adb reverse tcp:3000 tcp:3000
adb reverse tcp:3001 tcp:3001
echo [dev] Ports 3000 + 3001 forwarded to device.
echo.

echo [dev] Syncing and running Capacitor on device...
cd mobile
call npm install
call npx cap sync android
call npx cap run android

:end
pause
