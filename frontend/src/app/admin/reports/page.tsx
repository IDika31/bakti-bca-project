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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import type { ApiResponse } from "@/types";
import { useRequireRole } from "@/hooks/use-require-role";

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

function ymd(d: Date) {
  return d.toISOString().split("T")[0];
}

type PresetKey = "today" | "7d" | "30d" | "month" | "lastMonth";

function getPresetRange(key: PresetKey): { start: string; end: string } {
  const now = new Date();
  const end = ymd(now);
  if (key === "today") return { start: end, end };
  if (key === "7d") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: ymd(s), end };
  }
  if (key === "30d") {
    const s = new Date(now);
    s.setDate(s.getDate() - 29);
    return { start: ymd(s), end };
  }
  if (key === "month") {
    return { start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), end };
  }
  const firstLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastLast = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: ymd(firstLast), end: ymd(lastLast) };
}

function DailyChart({ data }: { data: DailyData[] }) {
  // recharts ResponsiveContainer needs a measured client width; gate on mount
  // to avoid a zero-size first paint (and the SSR/no-window case).
  const [mounted] = useState(() => typeof window !== "undefined");

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Tidak ada data</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    }),
  }));

  return (
    <div className="h-72 w-full">
      {mounted && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
              tickFormatter={(v) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`;
                return String(v);
              }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const num = Number(value);
                if (name === "revenue") return [formatCurrency(num), "Pendapatan"];
                return [String(num), "Pesanan"];
              }}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
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

  const CHART_COLORS = [
    "hsl(var(--primary))",
    "#10b981",
    "#f59e0b",
    "#3b82f6",
    "#a855f7",
    "#f43f5e",
  ];
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
      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="method"
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={75}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                fontSize: 12,
              }}
              formatter={(value) => formatCurrency(Number(value))}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v) => <span className="text-muted-foreground">{v}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
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
  const { ready, allowed } = useRequireRole("OWNER", "ADMIN");
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("admin-token") || ""
      : "";

  const fetchReport = async (fromOverride?: string, toOverride?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: fromOverride ?? startDate,
        to: toOverride ?? endDate,
      });
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

  if (!ready || !allowed) return null;

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
      toast.error("Gagal mengekspor laporan");
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
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["today", "Hari Ini"],
                ["7d", "7 Hari"],
                ["30d", "30 Hari"],
                ["month", "Bulan Ini"],
                ["lastMonth", "Bulan Lalu"],
              ] as [PresetKey, string][]
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-xs"
                onClick={() => {
                  const r = getPresetRange(key);
                  setStartDate(r.start);
                  setEndDate(r.end);
                  fetchReport(r.start, r.end);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-4">
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
          <Button onClick={() => fetchReport()} className="rounded-xl">
            Tampilkan
          </Button>
          </div>
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
