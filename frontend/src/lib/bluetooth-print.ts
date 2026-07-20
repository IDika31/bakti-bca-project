// Web Bluetooth ESC/POS receipt printer for 58mm thermal printers.
// Most generic thermal printers expose the ESC/POS service over BLE with the
// well-known service UUID 000018f0-0000-1000-8000-00805f9b34fb and a write
// characteristic 00002af1-0000-1000-8000-00805f9b34fb.

const ESCPOS_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const ESCPOS_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number; // unit price (Rupiah)
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

// --- ESC/POS byte helpers (58mm = 32 chars/line) ---
const WIDTH = 32;
const ESC = 0x1b;
const GS = 0x1d;
const LF = "\n";

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

function text(t: string): Uint8Array {
  // Encode latin1-ish (printer default code page WPC1252). Strip chars we
  // can't represent to keep the receipt readable.
  const clean = t.replace(/[^\x20-\x7e]/g, "");
  return new TextEncoder().encode(clean);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function center(s: string): string {
  if (s.length >= WIDTH) return s.slice(0, WIDTH);
  const pad = Math.floor((WIDTH - s.length) / 2);
  return " ".repeat(pad) + s;
}

function padLine(left: string, right: string): string {
  const space = Math.max(1, WIDTH - left.length - right.length);
  return left + " ".repeat(space) + right;
}

function money(n: number): string {
  return "Rp" + n.toLocaleString("id-ID");
}

export function buildReceiptBytes(r: ReceiptData): Uint8Array {
  const parts: Uint8Array[] = [];
  // Init + enable ESC/POS
  parts.push(cmd(ESC, 0x40));
  // Align center, double-height/width for restaurant name
  parts.push(cmd(ESC, 0x61, 0x01));
  parts.push(cmd(GS, 0x21, 0x11));
  parts.push(text((r.restaurantName || "Rumah Makan").slice(0, WIDTH) + LF));
  parts.push(cmd(GS, 0x21, 0x00));
  parts.push(text(center("STRUK PESANAN") + LF));
  parts.push(cmd(ESC, 0x61, 0x00));

  parts.push(text(padLine(`No: #${r.orderNumber}`, "") + LF));
  parts.push(text(padLine("Tgl", new Date(r.createdAt).toLocaleString("id-ID")) + LF));
  parts.push(text(padLine("Tipe", r.orderType === "DINE_IN" ? "Dine In" : "Take Away") + LF));
  if (r.tableLabel) parts.push(text(padLine("Meja", r.tableLabel) + LF));
  if (r.customerName) parts.push(text(padLine("Plgn", r.customerName) + LF));
  parts.push(text("-".repeat(WIDTH) + LF));

  for (const it of r.items) {
    parts.push(text(`${it.qty}x ${it.name}`.slice(0, WIDTH) + LF));
    parts.push(text(padLine("", `${money(it.price * it.qty)}`) + LF));
  }

  parts.push(text("-".repeat(WIDTH) + LF));
  parts.push(text(padLine("Subtotal", money(r.subtotal)) + LF));
  if (r.serviceAmount > 0) parts.push(text(padLine("Service", money(r.serviceAmount)) + LF));
  if (r.taxAmount > 0) parts.push(text(padLine("Pajak", money(r.taxAmount)) + LF));
  parts.push(cmd(ESC, 0x45, 0x02)); // bold on (double)
  parts.push(text(padLine("TOTAL", money(r.grandTotal)) + LF));
  parts.push(cmd(ESC, 0x45, 0x00)); // bold off
  if (r.paymentMethod) {
    const pm = r.paymentMethod === "CASH" ? "TUNAI" : r.paymentMethod === "QRIS" ? "QRIS" : r.paymentMethod;
    parts.push(text(padLine("Bayar", pm) + LF));
  }
  parts.push(text(LF));
  parts.push(cmd(ESC, 0x61, 0x01));
  parts.push(text(center("Terima Kasih") + LF));
  parts.push(text(center("Semoga lekas datang lagi") + LF));
  parts.push(cmd(ESC, 0x61, 0x00));
  parts.push(text(LF + LF));

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
