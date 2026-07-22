"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  isPrinterConnected,
  pairPrinter,
  reconnectPrinter,
  printReceiptAuto,
  type ReceiptData,
} from "@/lib/bluetooth-print";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { ApiResponse } from "@/types";

const SOUND_KEY = "admin-sound-enabled";
const BROWSER_KEY = "admin-browser-notif";

// Loud, persistent alert: a rising 4-beep two-tone burst on a square wave
// (full gain) played TWICE so it cuts through a noisy kitchen, plus a
// vibration pattern on supported devices. ~9s total.
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    // Resume in case the context was created suspended (autoplay policy).
    if (ctx.state === "suspended") void ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 1.0; // max gain — loud
    master.connect(ctx.destination);

    const beep = (startAt: number, freqA: number, freqB: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.connect(env);
      env.connect(master);
      osc.type = "square"; // brighter, harsher — easier to hear over noise
      osc.frequency.setValueAtTime(freqA, startAt);
      osc.frequency.setValueAtTime(freqB, startAt + 0.12);
      // Sharp attack, slight decay, hold, then quick release per beep.
      env.gain.setValueAtTime(0.0001, startAt);
      env.gain.exponentialRampToValueAtTime(1.0, startAt + 0.02);
      env.gain.setValueAtTime(1.0, startAt + 0.38);
      env.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.5);
      osc.start(startAt);
      osc.stop(startAt + 0.52);
    };

    // One rising 4-beep burst (~2.3s). Repeat it twice with a short gap.
    const burst = (offset: number) => {
      beep(offset, 880, 1174.66);           // beep 1
      beep(offset + 0.6, 880, 1174.66);     // beep 2
      beep(offset + 1.2, 988, 1318.51);     // beep 3 (higher)
      beep(offset + 1.8, 1174.66, 1567.98); // beep 4 (highest, most urgent)
    };

    const t = ctx.currentTime;
    burst(t);        // first burst
    burst(t + 2.6);  // second burst — repeats so it's harder to miss

    // Close the AudioContext after the last beep finishes.
    const totalMs = (2.6 + 1.8 + 0.52) * 1000 + 200;
    window.setTimeout(() => { void ctx.close(); }, totalMs);
  } catch {}

  // Vibrate on supported devices (Android/Chrome). Pattern: two long buzzes.
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([400, 120, 400, 120, 700]);
    }
  } catch {}
}

// Flash the browser tab title until the window is focused, so a new order is
// visible even when the admin tab is in the background. Cleans up on focus.
let titleFlashTimer: ReturnType<typeof setInterval> | null = null;
let originalTitle = "";
function flashTabTitle(message: string) {
  if (typeof document === "undefined") return;
  if (!originalTitle) originalTitle = document.title;
  if (titleFlashTimer) clearInterval(titleFlashTimer);
  let toggle = false;
  titleFlashTimer = setInterval(() => {
    document.title = toggle ? originalTitle : message;
    toggle = !toggle;
  }, 800);
  const stop = () => {
    if (titleFlashTimer) { clearInterval(titleFlashTimer); titleFlashTimer = null; }
    document.title = originalTitle;
    window.removeEventListener("focus", stop);
    window.removeEventListener("visibilitychange", onVis);
  };
  const onVis = () => { if (document.visibilityState === "visible") stop(); };
  window.addEventListener("focus", stop);
  window.addEventListener("visibilitychange", onVis);
}

interface NotifCtxValue {
  unreadCount: number;
  soundEnabled: boolean;
  browserEnabled: boolean;
  printerConnected: boolean;
  toggleSound: () => void;
  toggleBrowser: () => Promise<void>;
  pairPrinter: () => Promise<void>;
}

const NotifCtx = createContext<NotifCtxValue>({
  unreadCount: 0,
  soundEnabled: true,
  browserEnabled: false,
  printerConnected: false,
  toggleSound: () => {},
  toggleBrowser: async () => {},
  pairPrinter: async () => {},
});

export function useAdminNotifications() {
  return useContext(NotifCtx);
}

export function AdminNotificationsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const soundRef = useRef(true);
  const browserRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = localStorage.getItem(SOUND_KEY) !== "false";
    const b = localStorage.getItem(BROWSER_KEY) === "true";
    setSoundEnabled(s);
    setBrowserEnabled(b);
    soundRef.current = s;
    browserRef.current = b;
    // Silently reconnect to a previously-paired Bluetooth printer (no prompt).
    reconnectPrinter().then(setPrinterConnected);
  }, []);

  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { browserRef.current = browserEnabled; }, [browserEnabled]);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin/orders") setUnreadCount(0);
  }, [pathname]);

  useEffect(() => {
    if (!supabase) return;
    // Guard against double-subscription: React StrictMode (dev) invokes effects
    // twice, and removeChannel is async, so a naive subscribe can leave two live
    // channels — firing the sound (and every notification) twice per order.
    // Drop any pre-existing channel with this name before opening a new one.
    for (const ch of supabase.getChannels()) {
      if (ch.topic === "realtime:admin-orders-global") supabase.removeChannel(ch);
    }
    const channel = supabase
      .channel("admin-orders-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const orderNumber = (payload.new as { order_number?: string } | null)?.order_number || "";
          const orderId = (payload.new as { id?: string } | null)?.id;

          if (pathnameRef.current !== "/admin/orders") {
            setUnreadCount((c) => c + 1);
          }
          if (soundRef.current) playNotificationSound();
          flashTabTitle(`🔔 PESANAN BARU #${orderNumber}`);
          toast.info(`Pesanan baru: #${orderNumber}`, {
            action: orderId
              ? {
                  label: "Lihat",
                  onClick: () => routerRef.current.push(`/admin/orders?highlight=${orderId}`),
                }
              : undefined,
          });
          if (browserRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
            const n = new Notification("Pesanan baru masuk", {
              body: `#${orderNumber}`,
              tag: `order-${orderId ?? orderNumber}`,
            });
            n.onclick = () => {
              window.focus();
              if (orderId) routerRef.current.push(`/admin/orders?highlight=${orderId}`);
            };
          }
          // Auto-print the receipt if a Bluetooth printer is already connected.
          // Silent (no prompt) — only fires when paired earlier in the session.
          if (orderId) void autoPrintNewOrder(orderId);
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, []);

  const toggleSound = () => {
    setSoundEnabled((v) => {
      const next = !v;
      localStorage.setItem(SOUND_KEY, String(next));
      toast.info(next ? "Notifikasi suara aktif" : "Notifikasi suara nonaktif");
      return next;
    });
  };

  const toggleBrowser = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Browser tidak mendukung notifikasi");
      return;
    }
    if (browserEnabled) {
      setBrowserEnabled(false);
      localStorage.setItem(BROWSER_KEY, "false");
      toast.info("Notifikasi browser dimatikan");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setBrowserEnabled(true);
      localStorage.setItem(BROWSER_KEY, "true");
      toast.success("Notifikasi browser aktif");
    } else {
      toast.error("Izin notifikasi ditolak");
    }
  };

  // Fetch the full order + print its receipt to the connected Bluetooth printer.
  // Best-effort + silent: only runs when a printer is already paired this session.
  const autoPrintNewOrder = async (orderId: string) => {
    if (!isPrinterConnected()) return;
    try {
      const token = localStorage.getItem("admin-token") || "";
      const res = await api.get<
        ApiResponse<{
          orderNumber: string;
          orderType: string;
          customerName: string | null;
          createdAt: string;
          subtotal: number;
          serviceAmount: number;
          taxAmount: number;
          grandTotal: number;
          table: { number: number; name: string | null } | null;
          items: Array<{ quantity: number; price: number; menuItem: { name: string } }>;
          transaction: { paymentMethod: string | null } | null;
        }>
      >(`/api/admin/orders/${orderId}`, { token });
      const o = res.data;
      if (!o) return;
      const receipt: ReceiptData = {
        orderNumber: o.orderNumber,
        orderType: o.orderType as "DINE_IN" | "TAKE_AWAY",
        tableLabel: o.table ? o.table.name || `Meja ${o.table.number}` : null,
        customerName: o.customerName,
        createdAt: o.createdAt,
        items: o.items.map((it) => ({ name: it.menuItem.name, qty: it.quantity, price: it.price })),
        subtotal: o.subtotal,
        serviceAmount: o.serviceAmount,
        taxAmount: o.taxAmount,
        grandTotal: o.grandTotal,
        paymentMethod: o.transaction?.paymentMethod ?? null,
      };
      await printReceiptAuto(receipt);
    } catch {
      // silent — auto-print must not interrupt the operator
    }
  };

  const handlePairPrinter = async () => {
    const ok = await pairPrinter();
    setPrinterConnected(ok);
    toast[ok ? "success" : "error"](
      ok ? "Printer Bluetooth terhubung — struk akan cetak otomatis saat pesanan baru" : "Gagal menyambung printer"
    );
  };

  return (
    <NotifCtx.Provider
      value={{ unreadCount, soundEnabled, browserEnabled, printerConnected, toggleSound, toggleBrowser, pairPrinter: handlePairPrinter }}
    >
      {children}
    </NotifCtx.Provider>
  );
}

export function AdminNotifications() {
  const { soundEnabled, browserEnabled, printerConnected, toggleSound, toggleBrowser, pairPrinter } = useAdminNotifications();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={pairPrinter}
        title={printerConnected ? "Printer Bluetooth terhubung" : "Sambungkan printer Bluetooth"}
        className={printerConnected ? "text-emerald-600" : ""}
      >
        <Printer className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSound}
        title={soundEnabled ? "Matikan suara notifikasi" : "Nyalakan suara notifikasi"}
      >
        {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleBrowser}
        className="hidden text-xs sm:inline-flex"
        title="Notifikasi browser"
      >
        {browserEnabled ? "Browser: On" : "Browser: Off"}
      </Button>
    </div>
  );
}
