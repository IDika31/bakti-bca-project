// Capacitor native bridge — detected at runtime inside the Capacitor WebView.
// Provides foreground service, native BLE with auto-reconnect, and native notifications.

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

// ─── Native Local Notifications ─────────────────────────────────────

let notifPermissionGranted = false;

async function ensureNotifPermission(): Promise<boolean> {
  if (notifPermissionGranted) return true;
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) return false;
  try {
    const result = await plugin.checkPermissions();
    if (result.display === "granted") {
      notifPermissionGranted = true;
      return true;
    }
    const req = await plugin.requestPermissions();
    notifPermissionGranted = req.display === "granted";
    return notifPermissionGranted;
  } catch {
    return false;
  }
}

export async function showNativeNotification(title: string, body: string): Promise<void> {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) return;
  if (!(await ensureNotifPermission())) return;
  try {
    await plugin.schedule({
      notifications: [{
        title,
        body,
        id: Math.floor(Math.random() * 2147483647),
        sound: "default",
        smallIcon: "ic_stat_restaurant",
        channelId: "new-orders",
      }],
    });
  } catch (e) {
    console.warn("[Capacitor] Local notification failed:", e);
  }
}

export async function createNotificationChannel(): Promise<void> {
  const plugin = getPlugin("LocalNotifications");
  if (!plugin) return;
  try {
    await plugin.createChannel({
      id: "new-orders",
      name: "Pesanan Baru",
      description: "Notifikasi pesanan baru masuk",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
    });
  } catch {}
}

// ─── Native BLE ─────────────────────────────────────────────────────

const ESCPOS_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const ESCPOS_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";
const DEVICE_ID_KEY = "ble-printer-device-id";
const DEVICE_NAME_KEY = "ble-printer-device-name";

let nativeDeviceId: string | null = null;
let bleInitialized = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let autoReconnectEnabled = false;

// ─── Connection listeners ───────────────────────────────────────────

type ConnectionListener = (connected: boolean, deviceName?: string) => void;
const connectionListeners = new Set<ConnectionListener>();

export function onPrinterConnectionChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener);
  return () => { connectionListeners.delete(listener); };
}

function notifyConnectionChange(connected: boolean) {
  const name = loadDeviceName();
  for (const listener of connectionListeners) {
    try { listener(connected, name ?? undefined); } catch {}
  }
}

// ─── Device ID persistence ──────────────────────────────────────────

function loadDeviceId(): string | null {
  try { return localStorage.getItem(DEVICE_ID_KEY); } catch { return null; }
}

function saveDeviceId(id: string | null) {
  try {
    if (id) localStorage.setItem(DEVICE_ID_KEY, id);
    else localStorage.removeItem(DEVICE_ID_KEY);
  } catch {}
}

function loadDeviceName(): string | null {
  try { return localStorage.getItem(DEVICE_NAME_KEY); } catch { return null; }
}

function saveDeviceName(name: string | null) {
  try {
    if (name) localStorage.setItem(DEVICE_NAME_KEY, name);
    else localStorage.removeItem(DEVICE_NAME_KEY);
  } catch {}
}

// ─── BLE init ───────────────────────────────────────────────────────

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

// ─── Disconnect handler → auto-reconnect ────────────────────────────

function onDisconnect() {
  const wasConnected = nativeDeviceId !== null;
  nativeDeviceId = null;
  if (wasConnected) {
    console.log("[BLE] Printer disconnected — starting auto-reconnect");
    notifyConnectionChange(false);
  }
  if (autoReconnectEnabled) scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  const savedId = loadDeviceId();
  if (!savedId) return;

  const delay = Math.min(3000 * Math.pow(2, reconnectAttempt), 30000);
  console.log(`[BLE] Reconnect attempt ${reconnectAttempt + 1} in ${delay}ms`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!autoReconnectEnabled) return;

    const ble = await initBle();
    if (!ble) { reconnectAttempt++; scheduleReconnect(); return; }

    try {
      await ble.connect(savedId, onDisconnect);
      await ble.discoverServices(savedId);
      nativeDeviceId = savedId;
      reconnectAttempt = 0;
      notifyConnectionChange(true);
      console.log("[BLE] Reconnected successfully");
    } catch {
      reconnectAttempt++;
      if (autoReconnectEnabled) scheduleReconnect();
    }
  }, delay);
}

export function startPrinterAutoReconnect() {
  if (!isCapacitor()) return;
  autoReconnectEnabled = true;
  const savedId = loadDeviceId();
  if (!savedId || nativeDeviceId) return;
  reconnectAttempt = 0;
  scheduleReconnect();
}

export function stopPrinterAutoReconnect() {
  autoReconnectEnabled = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────

export async function nativePairPrinter(): Promise<boolean> {
  const ble = await initBle();
  if (!ble) return false;
  try {
    const device = await ble.requestDevice({
      services: [ESCPOS_SERVICE],
    });
    if (!device?.deviceId) return false;
    await ble.connect(device.deviceId, onDisconnect);
    await ble.discoverServices(device.deviceId);
    nativeDeviceId = device.deviceId;
    saveDeviceId(device.deviceId);
    saveDeviceName(device.name || null);
    reconnectAttempt = 0;
    notifyConnectionChange(true);
    return true;
  } catch (e) {
    console.warn("[Capacitor BLE] Pair failed:", e);
    return false;
  }
}

export async function nativeReconnectPrinter(): Promise<boolean> {
  const targetId = nativeDeviceId || loadDeviceId();
  if (!targetId) return false;
  const ble = await initBle();
  if (!ble) return false;
  try {
    await ble.connect(targetId, onDisconnect);
    await ble.discoverServices(targetId);
    nativeDeviceId = targetId;
    saveDeviceId(targetId);
    reconnectAttempt = 0;
    notifyConnectionChange(true);
    return true;
  } catch {
    if (autoReconnectEnabled) scheduleReconnect();
    return false;
  }
}

export function nativeIsPrinterConnected(): boolean {
  return nativeDeviceId !== null;
}

export function nativeHasSavedPrinter(): boolean {
  return loadDeviceId() !== null;
}

export function nativeGetSavedPrinterName(): string | null {
  return loadDeviceName();
}

export function nativeForgetPrinter() {
  stopPrinterAutoReconnect();
  nativeDeviceId = null;
  saveDeviceId(null);
  saveDeviceName(null);
  notifyConnectionChange(false);
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
        uint8ToDataView(chunk),
      );
    }
    return true;
  } catch (e) {
    console.warn("[Capacitor BLE] Write failed:", e);
    nativeDeviceId = null;
    notifyConnectionChange(false);
    if (autoReconnectEnabled) scheduleReconnect();
    return false;
  }
}
