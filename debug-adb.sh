#!/bin/bash
# ─── Debug APK via ADB on real Android device ─────────────────────────
# Prerequisites:
#   1. ADB installed and in PATH (comes with Android SDK platform-tools)
#   2. Device connected via USB with USB Debugging enabled
#   3. Frontend dev server running on port 3000
#   4. Backend dev server running on port 3001
#
# Usage: ./debug-adb.sh [device-serial]
#   device-serial: optional, from `adb devices`. Needed if >1 device.

set -e

echo "=== Checking ADB connection ==="
adb devices
echo ""

echo "=== Setting up port forwarding ==="
adb reverse tcp:3000 tcp:3000
adb reverse tcp:3001 tcp:3001
echo "Port 3000 (frontend) and 3001 (backend) forwarded to device."
echo ""

echo "=== Installing dependencies ==="
cd mobile
npm install
echo ""

echo "=== Syncing Capacitor ==="
npx cap add android 2>/dev/null || true
npx cap sync android
echo ""

if [ -z "$1" ]; then
    echo "=== Running on device ==="
    npx cap run android
else
    echo "=== Running on device: $1 ==="
    npx cap run android --target="$1"
fi

echo ""
echo "=== DONE ==="
echo "Make sure frontend (port 3000) and backend (port 3001) are running."
