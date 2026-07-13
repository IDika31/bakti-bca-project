"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Volume2, VolumeX, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import { toast } from "sonner";
import type { PaginatedResponse, ApiResponse } from "@/types";

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);

    // Two-tone chime
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    osc.onended = () => ctx.close();
  } catch {}
}

interface OrderAdmin {
  id: string;
  orderNumber: string;
  orderType: string;
  customerName: string | null;
  grandTotal: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  table: { number: number; name: string | null } | null;
  items: Array<{ id: string; quantity: number; menuItem: { name: string } }>;
  transaction: { reference: string; paymentMethod: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  PREPARING: "bg-primary/15 text-primary",
  READY: "bg-green-100 text-green-800",
  COMPLETED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initialLoad = useRef(true);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    const res = await api.get<PaginatedResponse<OrderAdmin>>(`/api/admin/orders?${params}`, { token });

    if (initialLoad.current) {
      knownOrderIds.current = new Set(res.data.map((o) => o.id));
      initialLoad.current = false;
    } else if (!supabase) {
      const newOrders = res.data.filter((o) => !knownOrderIds.current.has(o.id));
      if (newOrders.length > 0 && soundEnabled) {
        playNotificationSound();
        toast.info(`${newOrders.length} pesanan baru masuk!`);
      }
      knownOrderIds.current = new Set(res.data.map((o) => o.id));
    }

    setOrders(res.data);
    setLoading(false);
  }, [statusFilter, token, soundEnabled]);

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  // Supabase Realtime — instant updates; fallback to polling if not configured
  useEffect(() => {
    if (!supabase) {
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    }

    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "INSERT" && soundEnabled) {
            playNotificationSound();
            toast.info("Pesanan baru masuk!");
          }
          fetchOrders();
        }
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [statusFilter, fetchOrders, soundEnabled]);

  const updateStatus = async (orderId: string, orderStatus: string) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}`, { orderStatus }, { token });
      toast.success("Status diperbarui");
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update status");
    }
  };

  const markAsPaid = async (orderId: string) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}/pay`, {}, { token });
      toast.success("Pesanan ditandai lunas");
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update pembayaran");
    }
  };

  const completeOrder = async (orderId: string) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}/complete`, {}, { token });
      toast.success("Pesanan selesai");
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyelesaikan");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Pesanan</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? "Matikan notifikasi suara" : "Nyalakan notifikasi suara"}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "ALL")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="CONFIRMED">Diterima</SelectItem>
            <SelectItem value="PREPARING">Sedang Disiapkan</SelectItem>
            <SelectItem value="READY">Siap Diambil</SelectItem>
            <SelectItem value="COMPLETED">Selesai</SelectItem>
            <SelectItem value="CANCELLED">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Tidak ada pesanan</p>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.table
                        ? order.table.name || `Meja ${order.table.number}`
                        : order.customerName || "Take Away"}
                      {" · "}
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(order.grandTotal)}</p>
                    <Badge className={`text-xs ${STATUS_COLORS[order.orderStatus] || ""}`}>
                      {ORDER_STATUS_LABELS[order.orderStatus]}
                    </Badge>
                    {order.paymentStatus === "UNPAID" && (
                      <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-700">
                        Belum Bayar
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {order.items.map((item) => `${item.quantity}x ${item.menuItem.name}`).join(", ")}
                </div>

                {order.paymentStatus === "UNPAID" && !["COMPLETED", "CANCELLED"].includes(order.orderStatus) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => markAsPaid(order.id)}>
                      Tandai Lunas
                    </Button>
                    <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => completeOrder(order.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Lunas & Selesaikan
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(order.id, "CANCELLED")}>
                      Batal
                    </Button>
                  </div>
                )}

                {order.paymentStatus === "PAID" && !["COMPLETED", "CANCELLED"].includes(order.orderStatus) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.orderStatus === "CONFIRMED" && (
                      <Button size="sm" onClick={() => updateStatus(order.id, "PREPARING")}>
                        Proses
                      </Button>
                    )}
                    {order.orderStatus === "PREPARING" && (
                      <Button size="sm" onClick={() => updateStatus(order.id, "READY")}>
                        Siap
                      </Button>
                    )}
                    {order.orderStatus === "READY" && (
                      <Button size="sm" onClick={() => updateStatus(order.id, "COMPLETED")}>
                        Selesai
                      </Button>
                    )}
                    {order.orderStatus !== "READY" && (
                      <Button size="sm" variant="outline" className="gap-1 border-green-300 text-green-700 hover:bg-green-50" onClick={() => completeOrder(order.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Selesaikan
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => updateStatus(order.id, "CANCELLED")}>
                      Batal
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
