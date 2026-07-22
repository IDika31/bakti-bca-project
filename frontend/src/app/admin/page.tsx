"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  ShoppingBag,
  Clock,
  UtensilsCrossed,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from "@/lib/format";
import { useRequireRole } from "@/hooks/use-require-role";
import { toast } from "sonner";
import type { ApiResponse } from "@/types";
import Link from "next/link";

interface DashboardData {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalMenuItems: number;
  activeTables: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    grandTotal: number;
    orderStatus: string;
    orderType: string;
    customerName: string | null;
    createdAt: string;
    table: { number: number; name: string | null } | null;
    _count: { items: number };
  }>;
}

const STATUS_COLORS: Record<string, string> = {
  PLACED: "bg-slate-100 text-slate-700",
  PREPARING: "bg-blue-100 text-blue-700",
  READY: "bg-green-100 text-green-700",
  PICKED_UP: "bg-sky-100 text-sky-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function AdminDashboardPage() {
  const { ready, allowed } = useRequireRole("OWNER", "ADMIN", "CASHIER");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("admin-token");
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get<ApiResponse<DashboardData>>("/api/admin/dashboard", { token });
      setData(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keep polling as a fallback safety net in case the realtime connection
  // drops silently — realtime below handles the instant refresh in the
  // normal case, this just guarantees the dashboard is never more than
  // 30s stale even if that subscription fails.
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Instantly refresh the dashboard the moment a new order is inserted,
  // instead of waiting for the next 30s poll.
  useEffect(() => {
    if (!supabase) return;
    // Guard against double-subscription in React StrictMode (dev mode
    // invokes effects twice) — drop any pre-existing channel with this
    // name before opening a new one.
    for (const ch of supabase.getChannels()) {
      if (ch.topic === "realtime:admin-dashboard-orders") supabase.removeChannel(ch);
    }
    const channel = supabase
      .channel("admin-dashboard-orders")
      .on(
        // "*" (not just INSERT) so a payment-status flip (PAID via Tripay
        // callback or the cashier "tandai lunas" button) or a status change
        // like cancel/complete — both UPDATEs, not INSERTs — also trigger
        // an instant refresh instead of waiting for the 30s poll.
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => { void fetchData(); }
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [fetchData]);

  if (!ready || !allowed) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    {
      label: "Pendapatan Hari Ini",
      value: formatCurrency(data.todayRevenue),
      icon: DollarSign,
      color: "bg-emerald-500/10 text-emerald-600",
      ring: "ring-emerald-500/20",
      href: "/admin/reports",
    },
    {
      label: "Pesanan Hari Ini",
      value: data.todayOrders.toString(),
      icon: ShoppingBag,
      color: "bg-blue-500/10 text-blue-600",
      ring: "ring-blue-500/20",
      href: "/admin/orders",
    },
    {
      label: "Sedang Diproses",
      value: data.pendingOrders.toString(),
      icon: Clock,
      color: "bg-amber-500/10 text-amber-600",
      ring: "ring-amber-500/20",
      href: "/admin/orders",
    },
    {
      label: "Menu Aktif",
      value: data.totalMenuItems.toString(),
      icon: UtensilsCrossed,
      color: "bg-purple-500/10 text-purple-600",
      ring: "ring-purple-500/20",
      href: "/admin/menu",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Ringkasan aktivitas restoran hari ini
          </p>
        </div>
        <Link
          href="/admin/reports"
          className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <TrendingUp className="h-4 w-4" />
          Laporan
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="relative overflow-hidden rounded-2xl border-0 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color} ring-1 ${stat.ring}`}
                  >
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="rounded-2xl border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">
            Pesanan Terbaru
          </CardTitle>
          <Link
            href="/admin/orders"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Lihat Semua
            <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.recentOrders.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <ShoppingBag className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                Belum ada pesanan hari ini
              </p>
              <p className="text-xs text-muted-foreground/70">
                Pesanan akan muncul di sini
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {data.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href="/admin/orders"
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition-colors hover:bg-muted/50 -mx-2 px-2 rounded-lg"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                    {order._count.items}x
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {order.orderNumber}
                      </span>
                      <Badge
                        className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[order.orderStatus] || ""}`}
                      >
                        {ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {order.table
                        ? order.table.name || `Meja ${order.table.number}`
                        : order.customerName || "Take Away"}
                      {" · "}
                      {order.orderType === "DINE_IN" ? "Dine In" : "Take Away"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {formatCurrency(order.grandTotal)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}