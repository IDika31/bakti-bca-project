"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff, Printer, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  isPrinterConnected,
  pairPrinter,
  reconnectPrinter,
  printReceiptAuto,
  getRestaurantName,
  type ReceiptData,
} from "@/lib/bluetooth-print";
import {
  isCapacitor,
  startPrinterAutoReconnect,
  stopPrinterAutoReconnect,
  onPrinterConnectionChange,
  showNativeNotification,
  createNotificationChannel,
  nativeHasSavedPrinter,
} from "@/lib/capacitor-bridge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { ApiResponse } from "@/types";

const SOUND_KEY = "admin-sound-enabled";
const BROWSER_KEY = "admin-browser-notif";
const VOICE_KEY = "admin-voice-enabled";

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
      beep(offset + 1.2, 880, 1174.66);     // beep 2
      beep(offset + 1.8, 880, 1174.66);     // beep 2
      // beep(offset + 1.2, 988, 1318.51);     // beep 3 (higher)
      // beep(offset + 1.8, 1174.66, 1567.98); // beep 4 (highest, most urgent)
    };

    const t = ctx.currentTime;
    burst(t);        // first burst
    // burst(t + 2.6);  // second burst — repeats so it's harder to miss

    // Close the AudioContext after the last beep finishes.
    const totalMs = (1.8 + 0.52) * 1000 + 200;
    window.setTimeout(() => { void ctx.close(); }, totalMs);
  } catch {}

  // Vibrate on supported devices (Android/Chrome). Pattern: two long buzzes.
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([400, 120, 400, 120, 700]);
    }
  } catch {}
}

// Speak a short line via the browser's built-in TTS (Web Speech API).
// Returns a promise that resolves once speech playback actually finishes
// (or immediately if TTS isn't available/fails), so callers can chain
// announcements one after another instead of letting them overlap.
function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "id-ID";
      utter.rate = 0.95;
      utter.pitch = 1;
      utter.volume = 1;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    } catch {
      resolve();
    }
  });
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
  voiceEnabled: boolean;
  browserEnabled: boolean;
  printerConnected: boolean;
  toggleSound: () => void;
  toggleVoice: () => void;
  toggleBrowser: () => Promise<void>;
  pairPrinter: () => Promise<void>;
}

const NotifCtx = createContext<NotifCtxValue>({
  unreadCount: 0,
  soundEnabled: true,
  voiceEnabled: true,
  browserEnabled: false,
  printerConnected: false,
  toggleSound: () => {},
  toggleVoice: () => {},
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
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(false);
  const soundRef = useRef(true);
  const voiceRef = useRef(true);
  const browserRef = useRef(false);
  const voiceQueueRef = useRef<Array<{ orderId: string; orderNumber: string }>>([]);
  const isSpeakingRef = useRef(false);
  const pathnameRef = useRef(pathname);
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = localStorage.getItem(SOUND_KEY) !== "false";
    const v = localStorage.getItem(VOICE_KEY) !== "false";
    const b = localStorage.getItem(BROWSER_KEY) === "true";
    setSoundEnabled(s);
    setVoiceEnabled(v);
    setBrowserEnabled(b);
    soundRef.current = s;
    voiceRef.current = v;
    browserRef.current = b;
    // Silently reconnect to a previously-paired Bluetooth printer (no prompt).
    reconnectPrinter().then(setPrinterConnected);

    // Capacitor: start persistent auto-reconnect loop + listen for changes.
    if (isCapacitor()) {
      void createNotificationChannel();
      startPrinterAutoReconnect();
    }
  }, []);

  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { voiceRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { browserRef.current = browserEnabled; }, [browserEnabled]);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // Capacitor: listen for BLE connection changes from auto-reconnect loop.
  useEffect(() => {
    if (!isCapacitor()) return;
    const unsubscribe = onPrinterConnectionChange((connected) => {
      setPrinterConnected(connected);
      if (connected) toast.success("Printer Bluetooth terhubung kembali");
    });
    return () => {
      unsubscribe();
      stopPrinterAutoReconnect();
    };
  }, []);

  useEffect(() => {
    if (pathname === "/admin/orders") setUnreadCount(0);
  }, [pathname]);

  // Dedupe guard: an order can reach the UI two ways — the live realtime
  // event, or the catch-up fetch below — this stops it from notifying twice.
  const seenOrderIdsRef = useRef<Set<string>>(new Set());

  // Runs all the "a new order arrived" side effects (print, sound, toast,
  // browser notif, voice). Shared by both the live realtime handler and the
  // catch-up reconciliation, so the two paths behave identically.
  const handleNewOrder = (orderId: string | undefined, orderNumber: string) => {
    if (orderId) {
      if (seenOrderIdsRef.current.has(orderId)) return;
      seenOrderIdsRef.current.add(orderId);
    }

    // Fire the auto-print request FIRST, before anything else in this
    // handler, so the Bluetooth write is queued as early as physically
    // possible — every millisecond matters in a busy kitchen. It's
    // async and un-awaited, so it doesn't block the rest of the handler.
    if (orderId) void autoPrintNewOrder(orderId);

    if (pathnameRef.current !== "/admin/orders") {
      setUnreadCount((c) => c + 1);
    }
    if (soundRef.current) playNotificationSound();

    // Capacitor: native notification guarantees sound+vibration even in background
    // (AudioContext and SpeechSynthesis get suspended by Android when WebView is hidden).
    if (isCapacitor()) {
      void showNativeNotification("Pesanan Baru", `#${orderNumber} — pesanan baru masuk!`);
    }
    flashTabTitle(`🔔 PESANAN BARU #${orderNumber}`);
    toast.info(`Pesanan baru: #${orderNumber}`, {
      action: orderId
        ? {
            label: "Lihat",
            onClick: () => routerRef.current.push(`/admin/orders?highlight=${orderId}`),
          }
        : undefined,
    });
    // Use Service Worker notification when page is hidden (background) for
    // persistent system-level notification that survives app switching.
    const isHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
    if (isHidden && "serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "NEW_ORDER",
        orderNumber,
        orderId,
      });
    } else if (browserRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification("Pesanan baru masuk", {
        body: `#${orderNumber}`,
        tag: `order-${orderId ?? orderNumber}`,
      });
      n.onclick = () => {
        window.focus();
        if (orderId) routerRef.current.push(`/admin/orders?highlight=${orderId}`);
      };
    }

    // Speak "Pesanan baru masuk dari meja ..." after the beep burst so
    // the two sounds don't overlap and become unintelligible.
    if (orderId) {
      window.setTimeout(() => void announceOrder(orderId, orderNumber), 2600);
    }
  };

  useEffect(() => {
    if (!supabase) return;
    // Guard against double-subscription: React StrictMode (dev) invokes effects
    // twice, and removeChannel is async, so a naive subscribe can leave two live
    // channels — firing the sound (and every notification) twice per order.
    // Drop any pre-existing channel with this name before opening a new one.
    for (const ch of supabase.getChannels()) {
      if (ch.topic === "realtime:admin-orders-global") supabase.removeChannel(ch);
    }

    // Mark the moment we start trying to connect — this is the start of the
    // window an order could slip through before the socket is actually live.
    const connectingSince = new Date().toISOString();

    // Supabase Realtime does not replay anything that happened before the
    // channel reaches "SUBSCRIBED" — connecting the WebSocket and joining the
    // channel takes a beat, so an order placed in that gap (most likely right
    // after a fresh page load / re-login) fires no INSERT event at all. Once
    // we're actually subscribed, fetch anything created since connectingSince
    // and run it through the same handler, so it isn't silently missed.
    const catchUp = async (status: string) => {
      if (status !== "SUBSCRIBED") return;
      try {
        const token = localStorage.getItem("admin-token") || "";
        const res = await api.get<ApiResponse<Array<{ id: string; orderNumber: string }>>>(
          `/api/admin/orders?since=${encodeURIComponent(connectingSince)}&limit=20`,
          { token }
        );
        // API returns newest-first; replay oldest-first so notifications
        // (and the voice queue) land in the order they actually happened.
        for (const order of [...(res.data ?? [])].reverse()) {
          handleNewOrder(order.id, order.orderNumber);
        }
      } catch {
        // best-effort — a missed catch-up shouldn't break live notifications
      }
    };

    const channel = supabase
      .channel("admin-orders-global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const orderNumber = (payload.new as { order_number?: string } | null)?.order_number || "";
          const orderId = (payload.new as { id?: string } | null)?.id;
          handleNewOrder(orderId, orderNumber);
        }
      )
      .subscribe((status) => { void catchUp(status); });

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

  const toggleVoice = () => {
    setVoiceEnabled((v) => {
      const next = !v;
      localStorage.setItem(VOICE_KEY, String(next));
      toast.info(next ? "Suara pengumuman pesanan aktif" : "Suara pengumuman pesanan nonaktif");
      if (!next) {
        voiceQueueRef.current = []; // drop anything still waiting in line
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      }
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

  // Build the spoken text for an order, e.g. "Pesanan baru masuk dari meja 5"
  // or "... atas nama Budi". Falls back to the order number on any failure.
  const buildAnnouncementText = async (orderId: string, orderNumber: string) => {
    try {
      const token = localStorage.getItem("admin-token") || "";
      const res = await api.get<
        ApiResponse<{
          orderType: string;
          customerName: string | null;
          table: { number: number; name: string | null } | null;
        }>
      >(`/api/admin/orders/${orderId}`, { token });
      const o = res.data;
      if (!o) return `Pesanan baru masuk, nomor ${orderNumber}`;
      if (o.orderType === "DINE_IN" && o.table) {
        const label = o.table.name || `nomor ${o.table.number}`;
        return `Pesanan baru masuk dari meja ${label}`;
      }
      if (o.customerName) return `Pesanan baru masuk, atas nama ${o.customerName}`;
      return `Pesanan baru masuk, nomor ${orderNumber}`;
    } catch {
      return `Pesanan baru masuk, nomor ${orderNumber}`;
    }
  };

  // Process the voice queue one order at a time: fetch its text, speak it,
  // wait for playback to actually finish, THEN move to the next one. This is
  // what makes overlapping orders queue up instead of talking over each other.
  const processVoiceQueue = async () => {
    if (isSpeakingRef.current) return; // already processing — this call will be picked up by the loop below
    isSpeakingRef.current = true;
    while (voiceQueueRef.current.length > 0) {
      const next = voiceQueueRef.current.shift()!;
      if (!voiceRef.current) continue; // voice got disabled mid-queue — skip remaining speak, just drain
      const text = await buildAnnouncementText(next.orderId, next.orderNumber);
      await speak(text);
    }
    isSpeakingRef.current = false;
  };

  // Entry point called from the realtime listener: enqueue the order and
  // kick the queue processor (no-op if it's already running).
  const announceOrder = (orderId: string, orderNumber: string) => {
    if (!voiceRef.current) return;
    voiceQueueRef.current.push({ orderId, orderNumber });
    void processVoiceQueue();
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
          items: Array<{
            quantity: number;
            price: number;
            notes: string | null;
            menuItem: { name: string };
            addons?: Array<{ name: string; priceSnapshot: number; quantity: number }>;
          }>;
          transaction: { paymentMethod: string | null } | null;
        }>
      >(`/api/admin/orders/${orderId}`, { token });
      const o = res.data;
      if (!o) return;
      const restaurantName = await getRestaurantName();
      const receipt: ReceiptData = {
        orderNumber: o.orderNumber,
        orderType: o.orderType as "DINE_IN" | "TAKE_AWAY",
        tableLabel: o.table ? o.table.name || `Meja ${o.table.number}` : null,
        customerName: o.customerName,
        createdAt: o.createdAt,
        items: o.items.map((it) => ({
          name: it.menuItem.name,
          qty: it.quantity,
          price: it.price,
          addons: (it.addons ?? []).map((a) => ({
            name: a.name,
            qty: a.quantity,
            price: a.priceSnapshot,
          })),
          notes: it.notes,
        })),
        subtotal: o.subtotal,
        serviceAmount: o.serviceAmount,
        taxAmount: o.taxAmount,
        grandTotal: o.grandTotal,
        paymentMethod: o.transaction?.paymentMethod ?? null,
        restaurantName,
      };
      const printed = await printReceiptAuto(receipt);
      if (printed) {
        toast.success(`Struk #${o.orderNumber} tercetak otomatis`);
      } else {
        // Printer was connected when the order arrived but the write failed
        // (out of paper, moved out of range, powered off). Warn so the
        // operator can reprint manually — this is not the silent "never paired"
        // case, which returns early above.
        toast.warning(`Gagal cetak struk #${o.orderNumber} otomatis — cetak manual dari detail pesanan`);
      }
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
      value={{
        unreadCount,
        soundEnabled,
        voiceEnabled,
        browserEnabled,
        printerConnected,
        toggleSound,
        toggleVoice,
        toggleBrowser,
        pairPrinter: handlePairPrinter,
      }}
    >
      {children}
    </NotifCtx.Provider>
  );
}

export function AdminNotifications() {
  const {
    soundEnabled,
    voiceEnabled,
    browserEnabled,
    printerConnected,
    toggleSound,
    toggleVoice,
    toggleBrowser,
    pairPrinter,
  } = useAdminNotifications();
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
        size="icon"
        onClick={toggleVoice}
        title={voiceEnabled ? "Matikan suara pengumuman pesanan" : "Nyalakan suara pengumuman pesanan"}
      >
        {voiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
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