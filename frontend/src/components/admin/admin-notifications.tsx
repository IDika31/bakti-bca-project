"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const SOUND_KEY = "admin-sound-enabled";
const BROWSER_KEY = "admin-browser-notif";

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
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
