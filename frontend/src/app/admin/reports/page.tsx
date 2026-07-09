"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
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
  byPaymentMethod: PaymentMethodSummary[];
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
}

function getDefaultDates() {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  return { start, end };
}

export default function AdminReportsPage() {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await api.get<ApiResponse<ReportData>>(`/api/admin/reports?${params}`, { token });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ startDate, endDate });
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Laporan Keuangan</h2>
        <Button variant="outline" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div>
            <Label>Dari Tanggal</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-40" />
          </div>
          <div>
            <Label>Sampai Tanggal</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-40" />
          </div>
          <Button onClick={fetchReport}>Tampilkan</Button>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Pesanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.totalOrders}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Rata-rata per Pesanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(data.summary.averageOrderValue)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pendapatan Harian</CardTitle>
              </CardHeader>
              <CardContent>
                {data.daily.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada data</p>
                ) : (
                  <div className="space-y-2">
                    {data.daily.map((d) => (
                      <div key={d.date} className="flex items-center justify-between text-sm">
                        <span>{new Date(d.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(d.revenue)}</span>
                          <span className="ml-2 text-muted-foreground">({d.orders} pesanan)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per Metode Pembayaran</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byPaymentMethod.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada data</p>
                ) : (
                  <div className="space-y-2">
                    {data.byPaymentMethod.map((pm) => (
                      <div key={pm.method} className="flex items-center justify-between text-sm">
                        <span>{pm.method}</span>
                        <div className="text-right">
                          <span className="font-medium">{formatCurrency(pm.total)}</span>
                          <span className="ml-2 text-muted-foreground">({pm.count}x)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-muted-foreground">Gagal memuat laporan</p>
      )}
    </div>
  );
}
