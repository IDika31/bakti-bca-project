# Mobile Admin (Capacitor Android)

Native Android shell wrapping the admin panel. Provides:
- **Foreground Service** — keeps the app alive in background (like Grab/Gojek)
- **Native BLE** — Bluetooth printing works even when app is in background
- **Auto-Reconnect** — printer reconnects automatically with exponential backoff
- **Native Notifications** — sound + vibration even when app is minimized

## Prerequisites

- Node.js 18+
- Java 17+
- Android SDK (Android Studio or command-line tools)
- ADB (for real device debugging)

## Setup

```bash
cd mobile
npm install
npx cap add android
npx cap sync android
```

## Debug on Real Device (ADB)

Fastest way to test on your phone:

```bash
# From project root — sets up port forwarding + builds + installs
debug-adb.cmd            # Windows
./debug-adb.sh           # Linux/Mac

# Make sure these are running first:
# Terminal 1: cd frontend && npm run dev    (port 3000)
# Terminal 2: cd backend && npm run dev     (port 3001)
```

What the script does:
1. `adb reverse tcp:3000 tcp:3000` — forwards frontend
2. `adb reverse tcp:3001 tcp:3001` — forwards backend
3. Syncs Capacitor and runs on device

## Configure Server URL

Edit `capacitor.config.ts`:

```ts
// ADB debug (real device): http://localhost:3000/admin + adb reverse
// Emulator: http://10.0.2.2:3000/admin (auto-maps to host)
// Production: https://your-domain.com/admin
server: {
  url: "http://localhost:3000/admin",
  cleartext: true,
},
```

## Build APK (tanpa Android Studio)

```bash
# Windows
mobile\build-apk.cmd

# Linux/Mac
cd mobile && ./build-apk.sh
```

The debug APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

## How It Works

1. Capacitor WebView loads the admin panel from the server URL
2. On login, the **foreground service** starts — keeps the process alive
3. When a Bluetooth printer is paired, the device ID is **saved to localStorage**
4. If the printer disconnects, **auto-reconnect** kicks in:
   - Retries with exponential backoff (3s → 6s → 12s → 30s max)
   - Keeps retrying until reconnected
   - Works even when app is in background
5. New orders arrive via Supabase Realtime (WebSocket stays alive via foreground service)
6. **Native local notification** fires with sound — works in background
7. Auto-print fires immediately, even when the user has switched to another app

## Bluetooth Printer Behavior

- **First pair**: User taps printer icon → BLE scan dialog → select printer
- **Device saved**: Printer device ID persisted across app restarts
- **Auto-reconnect**: On disconnect, retries automatically (exponential backoff)
- **Background print**: Works via foreground service + native BLE plugin
- **Forget printer**: Long-press printer icon (if implemented in UI)

## Icons

Replace the placeholder icons in `android/app/src/main/res/` with your actual app icons.
To add the notification small icon, place `ic_stat_restaurant.png` in the appropriate `mipmap-*` folders.
