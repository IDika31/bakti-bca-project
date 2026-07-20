"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { ApiResponse } from "@/types";
import { useRequireRole } from "@/hooks/use-require-role";

interface PaymentMethodAdmin {
  id: string;
  code: string;
  name: string;
  groupName: string;
  type: string;
  feeMerchant: number;
  feeCustomer: number;
  minAmount: number | null;
  maxAmount: number | null;
  iconUrl: string | null;
  isActive: boolean;
  isShown: boolean;
  lastSyncedAt: string | null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const GROUP_LABELS: Record<string, string> = {
  VIRTUAL_ACCOUNT: "Virtual Account",
  CONVENIENCE_STORE: "Convenience Store",
  E_WALLET: "E-Wallet",
  DIRECT_DEBIT: "Direct Debit",
  CREDIT_CARD: "Kartu Kredit",
};

export default function AdminPaymentsPage() {
  const { ready, allowed } = useRequireRole("OWNER", "ADMIN");
  const [methods, setMethods] = useState<PaymentMethodAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cashierEnabled, setCashierEnabled] = useState(false);

  const lastSynced = methods.reduce<string | null>((latest, m) => {
    if (!m.lastSyncedAt) return latest;
    if (!latest || new Date(m.lastSyncedAt).getTime() > new Date(latest).getTime()) {
      return m.lastSyncedAt;
    }
    return latest;
  }, null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchData = async () => {
    const [methodsRes, cashierRes] = await Promise.all([
      api.get<ApiResponse<PaymentMethodAdmin[]>>("/api/admin/payments", { token }),
      api.get<ApiResponse<PaymentMethodAdmin | null>>("/api/admin/payments/cashier", { token }),
    ]);
    setMethods(methodsRes.data.filter((m) => m.code !== "CASHIER"));
    setCashierEnabled(cashierRes.data?.isShown ?? false);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.post("/api/admin/payments/sync", {}, { token });
      toast.success("Metode pembayaran disinkronkan dari Tripay");
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal sinkronisasi");
    } finally {
      setSyncing(false);
    }
  };

  const toggleCashier = async (enabled: boolean) => {
    try {
      await api.put("/api/admin/payments/cashier", { isShown: enabled }, { token });
      setCashierEnabled(enabled);
      toast.success(enabled ? "Bayar di Kasir diaktifkan" : "Bayar di Kasir dinonaktifkan");
    } catch {
      toast.error("Gagal mengubah status");
    }
  };

  const toggleShown = async (id: string, isShown: boolean) => {
    try {
      await api.patch(`/api/admin/payments/${id}`, { isShown }, { token });
      fetchData();
    } catch (err) {
      toast.error("Gagal mengubah status");
    }
  };

  const grouped = methods.reduce<Record<string, PaymentMethodAdmin[]>>((acc, m) => {
    const group = m.groupName || "OTHER";
    if (!acc[group]) acc[group] = [];
    acc[group].push(m);
    return acc;
  }, {});

  if (!ready || !allowed) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Metode Pembayaran</h2>
          {lastSynced && (
            <p className="text-xs text-muted-foreground">
              Terakhir disinkron {relativeTime(lastSynced)}
            </p>
          )}
        </div>
        <Button onClick={handleSync} disabled={syncing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          Sinkronisasi Tripay
        </Button>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">Bayar di Kasir</p>
            <p className="text-xs text-muted-foreground">
              Pelanggan bisa memilih bayar langsung di kasir
            </p>
          </div>
          <Switch
            checked={cashierEnabled}
            onCheckedChange={toggleCashier}
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : methods.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Belum ada metode pembayaran. Klik &quot;Sinkronisasi Tripay&quot; untuk mengambil data.
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {GROUP_LABELS[group] || group}
            </h3>
            {items.map((method) => (
              <Card key={method.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex-1">
                    <p className="font-medium">{method.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {method.code} · Fee merchant: Rp {(method.feeMerchant ?? 0).toLocaleString("id-ID")} · Fee customer: Rp {(method.feeCustomer ?? 0).toLocaleString("id-ID")}
                    </p>
                  </div>
                  {!method.isActive && (
                    <Badge variant="secondary" className="text-xs">Nonaktif di Tripay</Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tampilkan</span>
                    {method.isActive ? (
                      <Switch
                        checked={method.isShown}
                        onCheckedChange={(checked) => toggleShown(method.id, checked)}
                      />
                    ) : (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span>
                              <Switch
                                checked={method.isShown}
                                disabled
                              />
                            </span>
                          }
                        />
                        <TooltipContent>
                          Metode ini dinonaktifkan di Tripay dan tidak bisa diaktifkan sampai statusnya aktif kembali.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
