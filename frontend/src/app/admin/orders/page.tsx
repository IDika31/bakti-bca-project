"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import { toast } from "sonner";
import type { PaginatedResponse, ApiResponse } from "@/types";

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
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-orange-100 text-orange-800",
  READY: "bg-green-100 text-green-800",
  COMPLETED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const token = typeof window !== "undefined" ? localStorage.getItem("admin-token") || "" : "";

  const fetchOrders = async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    const res = await api.get<PaginatedResponse<OrderAdmin>>(`/api/admin/orders?${params}`, { token });
    setOrders(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [statusFilter]);

  // Poll every 15 seconds
  useEffect(() => {
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const updateStatus = async (orderId: string, orderStatus: string) => {
    try {
      await api.patch(`/api/admin/orders/${orderId}`, { orderStatus }, { token });
      toast.success("Status diperbarui");
      fetchOrders();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal update status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Pesanan</h2>
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
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">
                  {order.items.map((item) => `${item.quantity}x ${item.menuItem.name}`).join(", ")}
                </div>

                {order.paymentStatus === "PAID" && !["COMPLETED", "CANCELLED"].includes(order.orderStatus) && (
                  <div className="mt-3 flex gap-2">
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
