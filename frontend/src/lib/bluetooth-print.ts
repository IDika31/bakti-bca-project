// Web Bluetooth ESC/POS receipt printer for 58mm thermal printers.
// Most generic thermal printers expose the ESC/POS service over BLE with the
// well-known service UUID 000018f0-0000-1000-8000-00805f9b34fb and a write
// characteristic 00002af1-0000-1000-8000-00805f9b34fb.

import { api } from "@/lib/api";
import type { ApiResponse, RestaurantProfile } from "@/types";

const ESCPOS_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const ESCPOS_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";

// The restaurant name is the same for every receipt, so fetch it once and
// cache it for the session. Callers await getRestaurantName() before building
// a receipt; on failure it resolves to null and the receipt uses its fallback.
let cachedRestaurantName: string | null = null;

export async function getRestaurantName(): Promise<string | null> {
  if (cachedRestaurantName) return cachedRestaurantName;
  try {
    const res = await api.get<ApiResponse<RestaurantProfile>>("/api/restaurant");
    cachedRestaurantName = res.data?.name?.trim() || null;
  } catch {
    cachedRestaurantName = null;
  }
  return cachedRestaurantName;
}


export interface ReceiptAddon {
  name: string;
  qty: number;
  price: number; // unit price per addon (Rupiah)
}

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number; // unit price of the base menu item (Rupiah), addons excluded
  addons?: ReceiptAddon[];
  notes?: string | null;
}

export interface ReceiptData {
  orderNumber: string;
  orderType: "DINE_IN" | "TAKE_AWAY";
  tableLabel?: string | null;
  customerName?: string | null;
  createdAt: string;
  items: ReceiptItem[];
  subtotal: number;
  serviceAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod?: string | null;
  restaurantName?: string | null;
}

// --- ESC/POS byte helpers ---
// Samkuan SP58D: 58mm thermal, 384-dot line, Font A = 32 chars/line.
const WIDTH = 32;
const ESC = 0x1b;
const GS = 0x1d;
const LF = "\n";

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

function text(t: string): Uint8Array {
  // Encode latin1-ish (printer default code page WPC1252). Strip chars we
  // can't represent to keep the receipt readable, but KEEP newlines (0x0a) —
  // they are the line breaks the printer needs to lay the receipt out.
  const clean = t.replace(/[^\x20-\x7e\n]/g, "");
  return new TextEncoder().encode(clean);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// Center within a given column width (default full line). Used for both normal
// (32-col) and double-width (16-col) modes so headers never overflow the paper.
function center(s: string, width: number = WIDTH): string {
  if (s.length >= width) return s.slice(0, width);
  const pad = Math.floor((width - s.length) / 2);
  return " ".repeat(pad) + s;
}

function padLine(left: string, right: string): string {
  const space = Math.max(1, WIDTH - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function money(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}

// Word-wrap a string to `width` columns, breaking on spaces where possible and
// hard-splitting words longer than the line. Continuation lines get `indent`
// leading spaces so wrapped item names stay visually grouped.
function wrap(s: string, width: number, indent: number = 0): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const pad = " ".repeat(indent);
  const limit = (isFirst: boolean) => (isFirst ? width : width - indent);
  for (const w of words) {
    const isFirst = lines.length === 0;
    const max = limit(isFirst);
    // Hard-split a word that can't fit on its own line.
    if (w.length > max) {
      if (cur) { lines.push(isFirst ? cur : pad + cur); cur = ""; }
      let rest = w;
      while (rest.length > 0) {
        const m = limit(lines.length === 0);
        const chunk = rest.slice(0, m);
        rest = rest.slice(m);
        lines.push(lines.length === 0 ? chunk : pad + chunk);
      }
      continue;
    }
    const next = cur ? cur + " " + w : w;
    if (next.length > max) {
      lines.push(isFirst ? cur : pad + cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(lines.length === 0 ? cur : pad + cur);
  return lines.length ? lines : [""];
}

// Render one order line: "2x Nama Item ......... Rp30.000". The name wraps if
// it's long; the price sits right-aligned on the same line as the last name
// segment when it fits, else on its own right-aligned line.
function itemLine(qty: number, name: string, total: string): string {
  const prefix = `${qty}x `;
  const nameLines = wrap(name, WIDTH, prefix.length);
  // Attach the prefix to the first line.
  nameLines[0] = prefix + nameLines[0];
  const last = nameLines[nameLines.length - 1];
  // Fit the price on the last name line if there's room (min 1 space gap).
  if (last.length + 1 + total.length <= WIDTH) {
    nameLines[nameLines.length - 1] = padLine(last, total);
  } else {
    nameLines.push(padLine("", total));
  }
  return nameLines.join(LF);
}

export function buildReceiptBytes(r: ReceiptData): Uint8Array {
  const parts: Uint8Array[] = [];
  // Init + enable ESC/POS
  parts.push(cmd(ESC, 0x40));

  // --- Header: restaurant name, centered, double-HEIGHT only so the full
  // 32-char line width is usable (double-width would cap it at 16 and clip
  // longer names). Wrap so a long name spans two big lines instead of clipping.
  parts.push(cmd(ESC, 0x61, 0x01)); // center
  parts.push(cmd(GS, 0x21, 0x01));  // double height
  for (const line of wrap(r.restaurantName || "Rumah Makan", WIDTH)) {
    parts.push(text(line + LF));
  }
  parts.push(cmd(GS, 0x21, 0x00));  // normal size
  parts.push(text("STRUK PESANAN" + LF));
  parts.push(cmd(ESC, 0x61, 0x00)); // left align

  parts.push(text("=".repeat(WIDTH) + LF));
  parts.push(text(padLine("No", `#${r.orderNumber}`) + LF));
  parts.push(text(padLine("Tgl", new Date(r.createdAt).toLocaleString("id-ID")) + LF));
  parts.push(text(padLine("Tipe", r.orderType === "DINE_IN" ? "Dine In" : "Take Away") + LF));
  if (r.tableLabel) parts.push(text(padLine("Meja", r.tableLabel) + LF));
  if (r.customerName) parts.push(text(padLine("Plgn", r.customerName) + LF));
  parts.push(text("-".repeat(WIDTH) + LF));

  for (const it of r.items) {
    const addons = it.addons ?? [];
    const addonUnit = addons.reduce((s, a) => s + a.price * a.qty, 0);
    // Line total = (base + addons) * qty, matching what the customer pays.
    const lineTotal = (it.price + addonUnit) * it.qty;
    parts.push(text(itemLine(it.qty, it.name, money(lineTotal)) + LF));
    // Addons under the item, indented 2 cols, so the kitchen sees the full spec.
    if (it.notes && it.notes.trim()) {
      for (const line of wrap(`(${it.notes.trim()})`, WIDTH - 2)) parts.push(text("  " + line + LF));
    }
    for (const a of addons) {
      const label = a.qty > 1 ? `+ ${a.qty}x ${a.name}` : `+ ${a.name}`;
      for (const line of wrap(label, WIDTH - 2)) parts.push(text("  " + line + LF));
    }
    // Item note (e.g. "tanpa gula") — indented, so it isn't missed.
  }

  parts.push(text("-".repeat(WIDTH) + LF));
  parts.push(text(padLine("Subtotal", money(r.subtotal)) + LF));
  if (r.serviceAmount > 0) parts.push(text(padLine("Service", money(r.serviceAmount)) + LF));
  if (r.taxAmount > 0) parts.push(text(padLine("Pajak", money(r.taxAmount)) + LF));
  parts.push(text("-".repeat(WIDTH) + LF));
  parts.push(cmd(ESC, 0x45, 0x01)); // bold on
  parts.push(text(padLine("TOTAL", money(r.grandTotal)) + LF));
  parts.push(cmd(ESC, 0x45, 0x00)); // bold off
  if (r.paymentMethod) {
    const pm = r.paymentMethod === "CASH" ? "TUNAI" : r.paymentMethod === "QRIS" ? "QRIS" : r.paymentMethod;
    parts.push(text(padLine("Bayar", pm) + LF));
  }
  parts.push(text("=".repeat(WIDTH) + LF));
  parts.push(cmd(ESC, 0x61, 0x01)); // center
  parts.push(text(LF));
  parts.push(text("Terima Kasih" + LF));
  parts.push(text("Semoga lekas datang lagi" + LF));
  parts.push(cmd(ESC, 0x61, 0x00)); // left align

  // Feed + cut
  parts.push(cmd(ESC, 0x64, 0x03));
  parts.push(cmd(GS, 0x56, 0x00));
  return concat(...parts);
}

export function isBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

// Cache the connected printer's write characteristic so we can print on new
// orders without re-prompting. Web Bluetooth can't persist across reloads, so
// we also try to auto-reconnect to previously-paired devices on mount.
let cachedChar: BluetoothRemoteGATTCharacteristic | null = null;

export function isPrinterConnected(): boolean {
  return cachedChar !== null;
}

// Pick + connect to a printer via the browser pairing dialog (needs a user
// gesture). Caches the characteristic for later no-prompt prints.
async function connectPrinter(): Promise<BluetoothRemoteGATTCharacteristic | null> {
  if (!isBluetoothSupported()) return null;
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [ESCPOS_SERVICE] }],
    optionalServices: [ESCPOS_SERVICE],
  });
  const server = await device.gatt?.connect();
  if (!server) return null;
  const service = await server.getPrimaryService(ESCPOS_SERVICE);
  const char = await service.getCharacteristic(ESCPOS_CHAR);
  cachedChar = char;
  // Reconnect automatically if the printer disconnects mid-session.
  device.addEventListener("gattserverdisconnected", () => {
    if (cachedChar === char) cachedChar = null;
  });
  return char;
}

// Reconnect to a previously-paired printer WITHOUT a prompt (no user gesture).
// Uses navigator.bluetooth.getDevices() (Chrome 100+). Returns true if a
// printer is now connected and cached.
export async function reconnectPrinter(): Promise<boolean> {
  if (!isBluetoothSupported()) return false;
  if (cachedChar) return true;
  try {
    const devices = await navigator.bluetooth.getDevices();
    for (const device of devices) {
      if (!device.gatt?.connected) {
        try { await device.gatt?.connect(); } catch { continue; }
      }
      if (!device.gatt?.connected) continue;
      const service = await device.gatt.getPrimaryService(ESCPOS_SERVICE);
      cachedChar = await service.getCharacteristic(ESCPOS_CHAR);
      device.addEventListener("gattserverdisconnected", () => {
        if (cachedChar && cachedChar.service === service) cachedChar = null;
      });
      return true;
    }
  } catch {
    // getDevices unavailable or blocked — user must pair manually
  }
  return false;
}

/** Pair a printer (user gesture required — bind to a button click). */
export async function pairPrinter(): Promise<boolean> {
  try {
    const char = await connectPrinter();
    return char !== null;
  } catch {
    return false;
  }
}

// Chunked write — BLE characteristics cap ~180 bytes per write on most printers.
async function writeChunked(char: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
  const CHUNK = 180;
  for (let i = 0; i < data.length; i += CHUNK) {
    await char.writeValueWithoutResponse(data.slice(i, i + CHUNK));
  }
}

/**
 * Print a receipt to a Bluetooth ESC/POS printer. Prompts the user to pick a
 * device (browser pairing dialog). Returns true on success, false if Bluetooth
 * is unsupported (caller should fall back to window.print()).
 */
export async function printReceiptBluetooth(r: ReceiptData): Promise<boolean> {
  const char = await connectPrinter();
  if (!char) return false;
  await writeChunked(char, buildReceiptBytes(r));
  try { char.service?.device?.gatt?.disconnect(); } catch {}
  return true;
}

export type PrintResult = "bluetooth" | "browser" | "failed";

/**
 * Print a receipt from a user gesture (button click). Tries the cached
 * Bluetooth printer first; if none is connected, prompts to pair; if Bluetooth
 * is unsupported or pairing fails, falls back to the browser print dialog.
 */
export async function printReceipt(r: ReceiptData): Promise<PrintResult> {
  if (isBluetoothSupported()) {
    // Use the cached printer if available, otherwise try to reconnect silently.
    if (!cachedChar) await reconnectPrinter();
    if (cachedChar) {
      try {
        await writeChunked(cachedChar, buildReceiptBytes(r));
        return "bluetooth";
      } catch {
        cachedChar = null;
      }
    }
    // No cached printer — prompt to pair (needs the user gesture from the call).
    try {
      const ok = await printReceiptBluetooth(r);
      if (ok) return "bluetooth";
    } catch {
      // cancelled or failed — fall through to browser print
    }
  }
  return printReceiptBrowser(r) ? "browser" : "failed";
}

/**
 * Auto-print a receipt with NO user gesture (e.g. on a realtime new-order
 * event). Only prints if a Bluetooth printer is already connected (cached) or
 * can be silently reconnected. Never prompts and never opens a browser print
 * dialog — auto-print must be silent. Returns true if printed.
 */
export async function printReceiptAuto(r: ReceiptData): Promise<boolean> {
  if (!isBluetoothSupported()) return false;
  if (!cachedChar) await reconnectPrinter();
  if (!cachedChar) return false;
  try {
    await writeChunked(cachedChar, buildReceiptBytes(r));
    return true;
  } catch {
    cachedChar = null;
    return false;
  }
}

/**
 * Fallback: open a print window with a plain-text receipt and call print().
 * Used when Bluetooth is unavailable or the user declines to pair.
 * Returns true if the print window opened, false if popup was blocked.
 */
export function printReceiptBrowser(r: ReceiptData): boolean {
  const bytes = buildReceiptBytes(r);
  const body = new TextDecoder().decode(bytes).replace(/[^\x20-\x7e\n]/g, "");
  const w = window.open("", "_blank", "width=380,height=600");
  if (!w) return false;
  w.document.write(
    `<pre style="font-family: 'Courier New', monospace; font-size: 12px; white-space: pre; margin: 8px;">${escapeHtml(body)}</pre>`
  );
  w.document.close();
  w.focus();
  w.print();
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
