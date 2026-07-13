"use client";

import { useEffect, useState } from "react";
import {
  Download,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  CreditCard,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { ApiResponse } from "@/types";

interface DailyData {
  date: string;
  orders: number;
  revenue: number;
}

interface PaymentMethodSummary {
  method: string;
  count: number;
  total: number;
}

interface ReportData {
  daily: DailyData[];
  byMethod: PaymentMethodSummary[];
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalService: number;
    totalTax: number;
    dineInCount: number;
    takeAwayCount: number;
    averageOrder: number;
  };
}

function getDefaultDates() {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  return { start, end };
}

function DailyChart({ data }: { data: DailyData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Tidak ada data</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="space-y-1.5">
      {data.map((d) => {
        const pct = Math.round((d.revenue / maxRevenue) * 100);
        return (
          <div key={d.date} className="group flex items-center gap-3">
            <span className="w-14 flex-shrink-0 text-xs text-muted-foreground">
              {new Date(d.date).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
              })}
            </span>
            <div className="relative flex-1">
              <div className="h-7 overflow-hidden rounded-md bg-muted/50">
                <div
                  className="flex h-full items-center rounded-md bg-primary/15 transition-all group-hover:bg-primary/25"
                  style={{ width: `${Math.max(pct, 2)}%` }}
                >
                  <span className="truncate px-2 text-xs font-medium text-primary">
                    {pct > 25 ? formatCurrency(d.revenue) : ""}
                  </span>
                </div>
              </div>
            </div>
            <div className="w-24 text-right">
              {pct <= 25 && (
                <span className="text-xs font-medium">
                  {formatCurrency(d.revenue)}
                </span>
              )}
              <span className="ml-1 text-[11px] text-muted-foreground">
                ({d.orders})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MethodBreakdown({ data, total }: { data: PaymentMethodSummary[]; total: number }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CreditCard className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Tidak ada data</p>
      </div>
    );
  }

  const COLORS = [
    "bg-primary",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-rose-500",
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {data.map((pm, i) => {
          const pct = total > 0 ? (pm.total / total) * 100 : 0;
          return (
            <div
              key={pm.method}
              className={`${COLORS[i % COLORS.length]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${pm.method}: ${Math.round(pct)}%`}
            />
          );
        })}
      </div>
      <div className="space-y-2">
        {data.map((pm, i) => {
          const pct = total > 0 ? Math.round((pm.total / total) * 100) : 0;
          return (
            <div key={pm.method} className="flex items-center gap-3 text-sm">
              <div
                className={`h-3 w-3 flex-shrink-0 rounded-full ${COLORS[i % COLORS.length]}`}
              />
              <span className="flex-1 truncate font-medium">{pm.method}</span>
              <span className="text-muted-foreground">{pm.count}x</span>
              <span className="w-20 text-right font-semibold tabular-nums">
                {formatCurrency(pm.total)}
              </span>
              <span className="w-10 text-right text-xs text-muted-foreground">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("admin-token") || ""
      : "";

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: startDate, to: endDate });
      const res = await api.get<ApiResponse<ReportData>>(
        `/api/admin/reports?${params}`,
        { token }
      );
      setData({
        daily: res.data?.daily ?? [],
        byMethod: res.data?.byMethod ?? [],
        summary: {
          totalOrders: res.data?.summary?.totalOrders ?? 0,
          totalRevenue: res.data?.summary?.totalRevenue ?? 0,
          totalService: res.data?.summary?.totalService ?? 0,
          totalTax: res.data?.summary?.totalTax ?? 0,
          dineInCount: res.data?.summary?.dineInCount ?? 0,
          takeAwayCount: res.data?.summary?.takeAwayCount ?? 0,
          averageOrder: res.data?.summary?.averageOrder ?? 0,
        },
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ from: startDate, to: endDate });
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/reports/export?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error("Export gagal");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-${startDate}-${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Gagal mengekspor laporan");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Laporan Keuangan</h2>
          <p className="text-sm text-muted-foreground">
            Analisis pendapatan dan pesanan
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          onClick={handleExport}
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div>
            <Label className="text-xs text-muted-foreground">Dari Tanggal</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-40 rounded-xl"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Sampai Tanggal</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-40 rounded-xl"
            />
          </div>
          <Button onClick={fetchReport} className="rounded-xl">
            Tampilkan
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Total Pesanan",
                value: data.summary.totalOrders.toString(),
                sub: `${data.summary.dineInCount} dine-in · ${data.summary.takeAwayCount} take away`,
                icon: ShoppingBag,
                color: "bg-blue-500/10 text-blue-600",
              },
              {
                label: "Total Pendapatan",
                value: formatCurrency(data.summary.totalRevenue),
                sub: data.summary.totalTax > 0 || data.summary.totalService > 0
                  ? `Pajak ${formatCurrency(data.summary.totalTax)} · Servis ${formatCurrency(data.summary.totalService)}`
                  : null,
                icon: DollarSign,
                color: "bg-emerald-500/10 text-emerald-600",
              },
              {
                label: "Rata-rata / Pesanan",
                value: formatCurrency(data.summary.averageOrder),
                sub: null,
                icon: TrendingUp,
                color: "bg-purple-500/10 text-purple-600",
              },
            ].map((stat) => (
              <Card
                key={stat.label}
                className="rounded-2xl border-0 shadow-sm"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="text-2xl font-bold tracking-tight">
                        {stat.value}
                      </p>
                      {stat.sub && (
                        <p className="text-[11px] text-muted-foreground">
                          {stat.sub}
                        </p>
                      )}
                    </div>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}
                    >
                      <stat.icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  Pendapatan Harian
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DailyChart data={data.daily} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Per Metode Pembayaran
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MethodBreakdown
                  data={data.byMethod}
                  total={data.summary.totalRevenue}
                />
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-muted-foreground">
          Gagal memuat laporan
        </p>
      )}
    </div>
  );
}
