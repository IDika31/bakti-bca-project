"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { ApiResponse } from "@/types";

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

const GROUP_LABELS: Record<string, string> = {
  VIRTUAL_ACCOUNT: "Virtual Account",
  CONVENIENCE_STORE: "Convenience Store",
  E_WALLET: "E-Wallet",
  DIRECT_DEBIT: "Direct Debit",
  CREDIT_CARD: "Kartu Kredit",
};

export default function AdminPaymentsPage() {
  const [methods, setMethods] = useState<PaymentMethodAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cashierEnabled, setCashierEnabled] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Metode Pembayaran</h2>
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
                    <Switch
                      checked={method.isShown}
                      onCheckedChange={(checked) => toggleShown(method.id, checked)}
                      disabled={!method.isActive}
                    />
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
