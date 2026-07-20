"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, UtensilsCrossed, FolderOpen, ShoppingBag, Tags,
  CreditCard, Table2, Settings, BarChart3, LogOut, Menu, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { AdminNotifications, AdminNotificationsProvider, useAdminNotifications } from "@/components/admin/admin-notifications";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Pesanan", icon: ShoppingBag },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/categories", label: "Kategori", icon: FolderOpen },
  { href: "/admin/addons", label: "Addon", icon: Tags },
  { href: "/admin/tables", label: "Meja & QR", icon: Table2 },
  { href: "/admin/payments", label: "Pembayaran", icon: CreditCard },
  { href: "/admin/reports", label: "Laporan", icon: BarChart3 },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin/login") return <>{children}</>;
  return (
    <AdminNotificationsProvider>
      <AdminShell>{children}</AdminShell>
    </AdminNotificationsProvider>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);
  const { unreadCount } = useAdminNotifications();

  useEffect(() => {
    const token = localStorage.getItem("admin-token");
    const stored = localStorage.getItem("admin-user");
    if (!token) {
      router.replace("/admin/login");
      return;
    }
    if (stored) setUser(JSON.parse(stored));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("admin-token");
    localStorage.removeItem("admin-user");
    router.replace("/admin/login");
  };

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
          {NAV_ITEMS.map((item) => {
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
          <div className="mb-2 px-3 text-sm text-muted-foreground">{user?.name}</div>
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
            {NAV_ITEMS.find((i) => i.href === pathname)?.label || "Admin"}
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
