#!/bin/bash
# ─── Build APK tanpa Android Studio ─────────────────────────────────
# Hanya perlu: Java 17+ dan download Android command-line tools.
#
# 1. Download Android command-line tools:
#    https://developer.android.com/studio#command-line-tools-only
#
# 2. Extract ke folder, misal: C:\android-sdk\cmdline-tools\latest\
#
# 3. Set environment variables:
#    export ANDROID_HOME="C:\android-sdk"
#    export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
#
# 4. Install SDK packages yang diperlukan:
#    sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
#    sdkmanager --licenses   # accept all
#
# 5. Jalankan script ini dari folder mobile/:

set -e

echo "=== Installing dependencies ==="
npm install

echo "=== Adding Android platform ==="
npx cap add android 2>/dev/null || true
npx cap sync android

echo "=== Building APK ==="
cd android
chmod +x gradlew
./gradlew assembleDebug

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "=== DONE ==="
echo "APK tersedia di: android/$APK_PATH"
echo "Transfer ke HP dan install (aktifkan 'Unknown Sources' di Settings)."
