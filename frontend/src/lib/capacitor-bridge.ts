// Capacitor native bridge — detected at runtime inside the Capacitor WebView.
// Provides:
//   1. Foreground service (keeps the process alive in background)
//   2. Native BLE (replaces Web Bluetooth so printing works in background)
//
// Uses the global Capacitor plugin API injected by the native shell — the
// frontend has ZERO Capacitor dependencies. Everything resolves via
// window.Capacitor.Plugins.* which the native app injects automatically.

/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      Plugins: Record<string, any>;
    };
  }
}

export function isCapacitor(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.Capacitor &&
    window.Capacitor.isNativePlatform()
  );
}

function getPlugin(name: string): any | null {
  if (!isCapacitor()) return null;
  return window.Capacitor?.Plugins?.[name] ?? null;
}

// ─── Foreground Service ─────────────────────────────────────────────

let foregroundStarted = false;

export async function startForegroundService(): Promise<void> {
  if (!isCapacitor() || foregroundStarted) return;
  const plugin = getPlugin("ForegroundService");
  if (!plugin) return;
  try {
    await plugin.startForegroundService({
      id: 1001,
      title: "Admin Kasir",
      body: "Menerima pesanan dan mencetak struk otomatis",
      smallIcon: "ic_stat_restaurant",
    });
    foregroundStarted = true;
  } catch (e) {
    console.warn("[Capacitor] Foreground service failed:", e);
  }
}

export async function stopForegroundService(): Promise<void> {
  if (!isCapacitor() || !foregroundStarted) return;
  const plugin = getPlugin("ForegroundService");
  if (!plugin) return;
  try {
    await plugin.stopForegroundService();
    foregroundStarted = false;
  } catch {}
}

// ─── Native BLE ─────────────────────────────────────────────────────

const ESCPOS_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const ESCPOS_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";

let nativeDeviceId: string | null = null;
let bleInitialized = false;

async function initBle(): Promise<any> {
  const ble = getPlugin("BluetoothLe");
  if (!ble) return null;
  if (!bleInitialized) {
    await ble.initialize();
    bleInitialized = true;
  }
  return ble;
}

function uint8ToDataView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

export async function nativePairPrinter(): Promise<boolean> {
  const ble = await initBle();
  if (!ble) return false;
  try {
    const device = await ble.requestDevice({
      services: [ESCPOS_SERVICE],
    });
    if (!device?.deviceId) return false;
    await ble.connect(device.deviceId, () => {
      nativeDeviceId = null;
    });
    await ble.discoverServices(device.deviceId);
    nativeDeviceId = device.deviceId;
    return true;
  } catch (e) {
    console.warn("[Capacitor BLE] Pair failed:", e);
    return false;
  }
}

export async function nativeReconnectPrinter(): Promise<boolean> {
  if (!nativeDeviceId) return false;
  const ble = await initBle();
  if (!ble) return false;
  try {
    await ble.connect(nativeDeviceId, () => {
      nativeDeviceId = null;
    });
    await ble.discoverServices(nativeDeviceId);
    return true;
  } catch {
    nativeDeviceId = null;
    return false;
  }
}

export function nativeIsPrinterConnected(): boolean {
  return nativeDeviceId !== null;
}

export async function nativeWriteReceipt(data: Uint8Array): Promise<boolean> {
  if (!nativeDeviceId) return false;
  const ble = await initBle();
  if (!ble) return false;
  try {
    const CHUNK = 180;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      await ble.writeWithoutResponse(
        nativeDeviceId,
        ESCPOS_SERVICE,
        ESCPOS_CHAR,
        uint8ToDataView(chunk)
      );
    }
    return true;
  } catch (e) {
    console.warn("[Capacitor BLE] Write failed:", e);
    nativeDeviceId = null;
    return false;
  }
}
