# Mobile Admin (Capacitor Android)

Native Android shell wrapping the admin panel. Provides:
- **Foreground Service** — keeps the app alive in background
- **Native BLE** — Bluetooth printing works even when app is not in focus

## Prerequisites

- Node.js 18+
- Android Studio (with SDK 33+)
- Java 17+

## Setup

```bash
cd mobile
npm install
npx cap add android
npx cap sync android
```

## Configure Server URL

Edit `capacitor.config.ts` and set the `server.url` to your deployed admin URL:

```ts
server: {
  url: "https://your-domain.com/admin",
  cleartext: false,   // set to false for https
},
```

For local development, use `http://10.0.2.2:3000/admin` (Android emulator → host machine).

## Build & Run

```bash
# Open in Android Studio
npx cap open android

# Or run directly on connected device
npx cap run android

# Build APK
cd android && ./gradlew assembleDebug
```

The debug APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

## How It Works

1. The Capacitor WebView loads the admin panel from the server URL
2. On login, the foreground service starts automatically — this keeps the process alive
3. When a Bluetooth printer is paired, the native BLE plugin handles the connection
4. New orders arrive via Supabase Realtime (WebSocket stays alive thanks to foreground service)
5. Auto-print fires immediately, even when the user has switched to another app
6. System notifications appear via the Service Worker

## Icons

Replace the placeholder icons in `android/app/src/main/res/` with your actual app icons.
To add the notification small icon, place `ic_stat_restaurant.png` in the appropriate `mipmap-*` folders.
