"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, UtensilsCrossed, FolderOpen, ShoppingBag, Tags,
  CreditCard, Table2, Settings, BarChart3, LogOut, Menu, X, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AdminNotifications, AdminNotificationsProvider, useAdminNotifications } from "@/components/admin/admin-notifications";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getAdminToken, setAdminSession, clearAdminSession } from "@/lib/auth";
import { isCapacitor, startForegroundService } from "@/lib/capacitor-bridge";
import type { AdminRole, AdminUser, ApiResponse } from "@/types";

const ALL: AdminRole[] = ["OWNER", "ADMIN", "CASHIER"];

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; roles: AdminRole[] }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
  { href: "/admin/orders", label: "Pesanan", icon: ShoppingBag, roles: ALL },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/categories", label: "Kategori", icon: FolderOpen, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/addons", label: "Addon", icon: Tags, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/tables", label: "Meja & QR", icon: Table2, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/payments", label: "Pembayaran", icon: CreditCard, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/reports", label: "Laporan", icon: BarChart3, roles: ["OWNER", "ADMIN"] },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings, roles: ["OWNER"] },
  { href: "/admin/users", label: "Kelola User", icon: Users, roles: ["OWNER"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return (
    <AdminNotificationsProvider>
      <PwaHead />
      <AdminShell>{children}</AdminShell>
    </AdminNotificationsProvider>
  );
}

function PwaHead() {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      const el = document.createElement("link");
      el.rel = "manifest";
      el.href = "/manifest.json";
      document.head.appendChild(el);
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      const el = document.createElement("meta");
      el.name = "theme-color";
      el.content = "#09090b";
      document.head.appendChild(el);
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/admin-sw.js").catch(() => {});
    }
    if (isCapacitor()) {
      void startForegroundService();
    }
  }, []);
  return null;
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const { unreadCount } = useAdminNotifications();

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    // Verify session server-side (authoritative role + isActive). Falls back to
    // cached localStorage user for instant paint; refreshes from /me.
    const stored = localStorage.getItem("admin-user");
    if (stored) {
      try { setUser(JSON.parse(stored) as AdminUser); } catch { /* ignore */ }
    }
    api.get<ApiResponse<AdminUser>>("/api/admin/me", { token })
      .then((res) => { setUser(res.data); setAdminSession(token, res.data); })
      .catch(() => { clearAdminSession(); router.replace("/admin/login"); });
  }, [router]);

  const handleLogout = () => {
    clearAdminSession();
    router.replace("/admin/login");
  };

  const visibleNav = user ? NAV_ITEMS.filter((i) => i.roles.includes(user.role)) : NAV_ITEMS;
  const activeItem = visibleNav.find((i) => i.href === pathname);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-background transition-transform lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="font-bold">Admin Panel</span>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1 p-3">
          {visibleNav.map((item) => {
            const isOrders = item.href === "/admin/orders";
            const showBadge = isOrders && unreadCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full border-t p-3">
          <div className="mb-2 px-3 text-sm text-muted-foreground">
            <div className="truncate">{user?.name}</div>
            {user && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                {user.role}
              </span>
            )}
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3 text-sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Keluar
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1">
        <header className="flex h-14 items-center gap-2 border-b px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold">
            {activeItem?.label || "Admin"}
          </h2>
          <div className="ml-auto">
            <AdminNotifications />
          </div>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}
