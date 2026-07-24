@echo off
REM ─── Debug APK via ADB on real Android device ─────────────────────
REM Prerequisites:
REM   1. ADB installed and in PATH (comes with Android SDK platform-tools)
REM   2. Device connected via USB with USB Debugging enabled
REM   3. Frontend dev server running on port 3000
REM   4. Backend dev server running on port 3001
REM
REM Usage: debug-adb.cmd [device-serial]
REM   device-serial: optional, from `adb devices`. Needed if >1 device.

echo === Checking ADB connection ===
adb devices
echo.

echo === Setting up port forwarding ===
adb reverse tcp:3000 tcp:3000
adb reverse tcp:3001 tcp:3001
echo Port 3000 (frontend) and 3001 (backend) forwarded to device.
echo.

echo === Installing dependencies ===
cd mobile
call npm install
echo.

echo === Syncing Capacitor ===
call npx cap add android 2>nul
call npx cap sync android
echo.

if "%1"=="" (
    echo === Running on device ===
    call npx cap run android
) else (
    echo === Running on device: %1 ===
    call npx cap run android --target=%1
)

echo.
echo === DONE ===
echo Make sure frontend (port 3000) and backend (port 3001) are running.
pause
