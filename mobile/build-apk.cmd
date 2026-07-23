@echo off
REM ─── Build APK tanpa Android Studio (Windows) ─────────────────────
REM Hanya perlu: Java 17+ dan Android command-line tools.
REM
REM 1. Download Android command-line tools:
REM    https://developer.android.com/studio#command-line-tools-only
REM
REM 2. Extract ke folder, misal: C:\android-sdk\cmdline-tools\latest\
REM
REM 3. Set environment variables (System > Environment Variables):
REM    ANDROID_HOME = C:\android-sdk
REM    Tambahkan ke PATH:
REM      C:\android-sdk\cmdline-tools\latest\bin
REM      C:\android-sdk\platform-tools
REM
REM 4. Buka CMD, install SDK:
REM    sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
REM    sdkmanager --licenses
REM
REM 5. Jalankan script ini dari folder mobile\:

echo === Installing dependencies ===
call npm install

echo === Adding Android platform ===
call npx cap add android 2>nul
call npx cap sync android

echo === Building APK ===
cd android
call gradlew.bat assembleDebug

echo.
echo === DONE ===
echo APK tersedia di: android\app\build\outputs\apk\debug\app-debug.apk
echo Transfer ke HP dan install (aktifkan 'Unknown Sources' di Settings).
pause
