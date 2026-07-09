"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, ShoppingBag, Clock, UtensilsCrossed } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ApiResponse } from "@/types";

interface DashboardData {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  totalMenuItems: number;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    grandTotal: number;
    orderStatus: string;
    createdAt: string;
    table: { number: number; name: string | null } | null;
  }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin-token") || "";
    api
      .get<ApiResponse<DashboardData>>("/api/admin/dashboard", { token })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { label: "Pendapatan Hari Ini", value: formatCurrency(data.todayRevenue), icon: DollarSign },
    { label: "Pesanan Hari Ini", value: data.todayOrders.toString(), icon: ShoppingBag },
    { label: "Pesanan Diproses", value: data.pendingOrders.toString(), icon: Clock },
    { label: "Menu Aktif", value: data.totalMenuItems.toString(), icon: UtensilsCrossed },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pesanan Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pesanan</p>
          ) : (
            <div className="space-y-3">
              {data.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{order.orderNumber}</span>
                    {order.table && (
                      <span className="ml-2 text-muted-foreground">
                        · {order.table.name || `Meja ${order.table.number}`}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{formatCurrency(order.grandTotal)}</span>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
