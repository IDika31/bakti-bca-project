"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { ArrowLeft, CheckCircle2, Clock, ChefHat, Package, XCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import type { Order, ApiResponse } from "@/types";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-5 w-5 text-yellow-500" />,
  CONFIRMED: <CheckCircle2 className="h-5 w-5 text-blue-500" />,
  PREPARING: <ChefHat className="h-5 w-5 text-orange-500" />,
  READY: <Package className="h-5 w-5 text-green-500" />,
  COMPLETED: <CheckCircle2 className="h-5 w-5 text-green-600" />,
  CANCELLED: <XCircle className="h-5 w-5 text-red-500" />,
};

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const fetcher = useCallback(
    () => api.get<ApiResponse<Order>>(`/api/orders/${id}`).then((r) => r.data),
    [id]
  );

  const { data: order, loading } = usePolling(fetcher, 5000, {
    stopWhen: (o) => ["COMPLETED", "CANCELLED"].includes(o.orderStatus),
  });

  if (loading && !order) {
    return (
      <div className="space-y-4 px-4 py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Pesanan tidak ditemukan</p>
        <Button onClick={() => router.push("/")}>Kembali ke Menu</Button>
      </div>
    );
  }

  const steps = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];
  const currentIdx = steps.indexOf(order.orderStatus);

  return (
    <div className="px-4 pb-8 print:px-0">
      <div className="flex items-center gap-2 py-4 print:hidden">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">Status Pesanan</h1>
      </div>

      {/* Status tracker */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {STATUS_ICONS[order.orderStatus]}
            <div>
              <p className="font-semibold">{ORDER_STATUS_LABELS[order.orderStatus]}</p>
              <p className="text-xs text-muted-foreground">{order.orderNumber}</p>
            </div>
            <Badge variant="outline" className="ml-auto text-xs">
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </Badge>
          </div>

          {order.orderStatus !== "CANCELLED" && (
            <div className="mt-4 flex gap-1">
              {steps.map((step, i) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full ${i <= currentIdx ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment info */}
      {order.transaction && order.paymentStatus === "UNPAID" && (
        <Card className="mb-4 print:hidden">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Selesaikan pembayaran sebelum</p>
            <p className="font-mono text-sm font-bold">{formatDate(order.transaction.expiredTime)}</p>
            {order.transaction.payCode && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">Kode Bayar</p>
                <p className="select-all font-mono text-lg font-bold">{order.transaction.payCode}</p>
              </div>
            )}
            {order.transaction.qrUrl && (
              <img src={order.transaction.qrUrl} alt="QR Payment" className="mx-auto mt-2 h-48 w-48" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Order details */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Waktu</span>
            <span>{formatDate(order.createdAt)}</span>
          </div>
          {order.table && (
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Meja</span>
              <span>{order.table.name || `Meja ${order.table.number}`}</span>
            </div>
          )}
          {order.customerName && (
            <div className="mb-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Nama</span>
              <span>{order.customerName}</span>
            </div>
          )}

          <Separator className="my-3" />

          <div className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <span>{item.quantity}x {item.menuItem.name}</span>
                  {item.notes && <p className="text-xs text-muted-foreground">📝 {item.notes}</p>}
                </div>
                <span>{formatCurrency(item.priceSnapshot * item.quantity)}</span>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.serviceAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Service ({Number(order.servicePercent)}%)</span>
                <span>{formatCurrency(order.serviceAmount)}</span>
              </div>
            )}
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>PB1 ({Number(order.taxPercent)}%)</span>
                <span>{formatCurrency(order.taxAmount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatCurrency(order.grandTotal)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex gap-2 print:hidden">
        <Button variant="outline" className="flex-1 gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Cetak
        </Button>
        <Button className="flex-1" onClick={() => router.push("/")}>
          Pesan Lagi
        </Button>
      </div>
    </div>
  );
}
