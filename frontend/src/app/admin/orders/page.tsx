"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminOrderDetail } from "@/components/admin/admin-order-detail";
import { CheckCircle2, Search, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatCurrency, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import { toast } from "sonner";
import type { PaginatedResponse } from "@/types";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    params.set("page", String(page));
    params.set("limit", "20");
    const res = await api.get<PaginatedResponse<OrderAdmin>>(`/api/admin/orders?${params}`, { token });

    setOrders(res.data);
    setTotalPages(res.meta.totalPages);
    setTotal(res.meta.total);
    setLoading(false);
  }, [statusFilter, search, page, token]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!supabase) {
      const interval = setInterval(fetchOrders, 5000);
      return () => clearInterval(interval);
    }

    const channel = supabase
      .channel("admin-orders-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders()
      )
      .subscribe();

    return () => { supabase!.removeChannel(channel); };
  }, [fetchOrders]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateStatus = async (orderId: string, orderStatus: string) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}`, { orderStatus }, { token });
      toast.success("Status diperbarui");
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update status");
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      toast.error("Alasan minimal 3 karakter");
      return;
    }
    setCancelSubmitting(true);
    try {
      await api.patch(`/api/admin/orders/${cancelTarget}/cancel`, { reason }, { token });
      toast.success("Pesanan dibatalkan");
      setCancelTarget(null);
      setCancelReason("");
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membatalkan");
    } finally {
      setCancelSubmitting(false);
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
        <span className="text-sm text-muted-foreground">{total} total</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nomor pesanan atau nama..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "ALL"); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
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

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Tidak ada pesanan</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} pesanan ditemukan</p>
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id} className="transition-shadow hover:shadow-md">
                <CardContent className="p-4">
                  <button
                    type="button"
                    onClick={() => setDetailId(order.id)}
                    className="flex w-full items-start justify-between gap-2 text-left"
                  >
                    <div>
                      <p className="font-semibold group-hover:underline">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.table
                          ? order.table.name || `Meja ${order.table.number}`
                          : order.customerName || "Take Away"}
                        {" · "}
                        <span title={new Date(order.createdAt).toLocaleString("id-ID")}>{relativeTime(order.createdAt)}</span>
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
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailId(order.id)}
                    className="mt-2 block w-full text-left text-xs text-muted-foreground hover:text-foreground"
                  >
                    {order.items.map((item) => `${item.quantity}x ${item.menuItem.name}`).join(", ")}
                  </button>

                  {order.paymentStatus === "UNPAID" && !["COMPLETED", "CANCELLED"].includes(order.orderStatus) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700" onClick={() => markAsPaid(order.id)}>
                        Tandai Lunas
                      </Button>
                      <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={() => completeOrder(order.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Lunas & Selesaikan
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => { setCancelTarget(order.id); setCancelReason(""); }}>
                        Batal
                      </Button>
                    </div>
                  )}

                  <div className="mt-2">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => setDetailId(order.id)}>
                      <Eye className="h-3.5 w-3.5" />
                      Lihat detail
                    </Button>
                  </div>

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
                      <Button size="sm" variant="destructive" onClick={() => { setCancelTarget(order.id); setCancelReason(""); }}>
                        Batal
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <AdminOrderDetail orderId={detailId} onClose={() => setDetailId(null)} token={token} />

      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Pesanan</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="cancel-reason">Alasan pembatalan</Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Contoh: stok habis, dapur sudah tutup, dsb."
              rows={3}
              maxLength={500}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Alasan ini akan ditampilkan ke pelanggan pada halaman status pesanan.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelTarget(null)}>
                Batal
              </Button>
              <Button variant="destructive" onClick={submitCancel} disabled={cancelSubmitting}>
                {cancelSubmitting ? "Membatalkan..." : "Batalkan Pesanan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
