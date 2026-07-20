"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const SOUND_KEY = "admin-sound-enabled";
const BROWSER_KEY = "admin-browser-notif";

// Loud, persistent alert: three rising two-tone beeps at full gain so it
// cuts through a noisy kitchen. Each beep ~0.5s with a gap, total ~3.5s.
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

    const t = ctx.currentTime;
    beep(t, 880, 1174.66);          // beep 1
    beep(t + 0.7, 880, 1174.66);    // beep 2
    beep(t + 1.4, 988, 1318.51);    // beep 3 (higher, more urgent)

    // Close the AudioContext after the last beep finishes.
    const totalMs = (1.4 + 0.52) * 1000 + 200;
    window.setTimeout(() => { void ctx.close(); }, totalMs);
  } catch {}
}

interface NotifCtxValue {
  unreadCount: number;
  soundEnabled: boolean;
  browserEnabled: boolean;
  toggleSound: () => void;
  toggleBrowser: () => Promise<void>;
}

const NotifCtx = createContext<NotifCtxValue>({
  unreadCount: 0,
  soundEnabled: true,
  browserEnabled: false,
  toggleSound: () => {},
  toggleBrowser: async () => {},
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
  const soundRef = useRef(true);
  const browserRef = useRef(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = localStorage.getItem(SOUND_KEY) !== "false";
    const b = localStorage.getItem(BROWSER_KEY) === "true";
    setSoundEnabled(s);
    setBrowserEnabled(b);
    soundRef.current = s;
    browserRef.current = b;
  }, []);

  useEffect(() => { soundRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { browserRef.current = browserEnabled; }, [browserEnabled]);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    if (pathname === "/admin/orders") setUnreadCount(0);
  }, [pathname]);

  useEffect(() => {
    if (!supabase) return;
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
          toast.info(`Pesanan baru: #${orderNumber}`, {
            action: orderId
              ? {
                  label: "Lihat",
                  onClick: () => router.push(`/admin/orders?highlight=${orderId}`),
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
              if (orderId) router.push(`/admin/orders?highlight=${orderId}`);
            };
          }
        }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [router]);

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

  return (
    <NotifCtx.Provider value={{ unreadCount, soundEnabled, browserEnabled, toggleSound, toggleBrowser }}>
      {children}
    </NotifCtx.Provider>
  );
}

export function AdminNotifications() {
  const { soundEnabled, browserEnabled, toggleSound, toggleBrowser } = useAdminNotifications();
  return (
    <div className="flex items-center gap-1">
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
