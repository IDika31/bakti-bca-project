"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import { AlertCircle, Clock, MapPin, User, XCircle } from "lucide-react";

interface OrderItemDetail {
  id: string;
  quantity: number;
  price: number;
  notes: string | null;
  menuItem: { name: string; imageUrl: string | null; description: string | null };
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  orderType: string;
  customerName: string | null;
  customerEmail: string | null;
  subtotal: number;
  serviceAmount: number;
  taxAmount: number;
  grandTotal: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  updatedAt: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  table: { number: number; name: string | null } | null;
  items: OrderItemDetail[];
  transaction: {
    reference: string | null;
    paymentMethod: string | null;
    payCode?: string | null;
    status?: string | null;
    amount?: number | null;
    expiredTime?: string | null;
    paidAt?: string | null;
  } | null;
  childOrders?: Array<{
    id: string;
    orderNumber: string;
    grandTotal: number;
    orderStatus: string;
    createdAt: string;
  }>;
}

const S: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const P: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  UNPAID: "bg-amber-100 text-amber-800",
  EXPIRED: "bg-red-100 text-red-800",
  REFUNDED: "bg-slate-100 text-slate-800",
};

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}

export function AdminOrderDetail({
  orderId,
  onClose,
  token,
}: {
  orderId: string | null;
  onClose: () => void;
  token: string;
}) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setErr(null);
    setOrder(null);
    api
      .get<OrderDetail>(`/api/admin/orders/${orderId}`, { token })
      .then(setOrder)
      .catch((e) => setErr(e instanceof Error ? e.message : "Gagal memuat detail"))
      .finally(() => setLoading(false));
  }, [orderId, token]);

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">
            {order ? `#${order.orderNumber}` : "Detail Pesanan"}
          </DialogTitle>
        </DialogHeader>
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {err && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="h-4 w-4" />
            {err}
          </div>
        )}
        {order && <OrderBody order={order} />}
      </DialogContent>
    </Dialog>
  );
}

function OrderBody({ order }: { order: OrderDetail }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={S[order.orderStatus] || ""}>
          {ORDER_STATUS_LABELS[order.orderStatus] || order.orderStatus}
        </Badge>
        <Badge className={P[order.paymentStatus] || ""}>
          {PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
        </Badge>
        <Badge variant="outline">
          {order.orderType === "DINE_IN" ? "Dine In" : "Take Away"}
        </Badge>
      </div>

      {order.orderStatus === "CANCELLED" && order.cancellationReason && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <XCircle className="h-4 w-4" />
            Pesanan Dibatalkan
          </div>
          <p className="mt-1 text-sm text-red-900">{order.cancellationReason}</p>
          {order.cancelledAt && (
            <p className="mt-1 text-xs text-red-700/80">
              {new Date(order.cancelledAt).toLocaleString("id-ID")}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
        <Meta icon={<MapPin className="h-4 w-4" />} label="Meja"
          value={order.table ? order.table.name || `Meja ${order.table.number}` : "-"} />
        <Meta icon={<User className="h-4 w-4" />} label="Pelanggan"
          value={order.customerName || "Anonim"} />
        <Meta icon={<Clock className="h-4 w-4" />} label="Dibuat"
          value={new Date(order.createdAt).toLocaleString("id-ID")} />
        {order.customerEmail && (
          <Meta icon={<User className="h-4 w-4" />} label="Email" value={order.customerEmail} />
        )}
      </div>

      <ItemsSection items={order.items} />
      <TotalsSection order={order} />
      {order.transaction && <TransactionSection tx={order.transaction} />}
    </div>
  );
}

function ItemsSection({ items }: { items: OrderItemDetail[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Item pesanan ({items.length})</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 rounded-lg border p-2">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted">
              {item.menuItem.imageUrl ? (
                <Image src={item.menuItem.imageUrl} alt={item.menuItem.name} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                  N/A
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.menuItem.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity} × {formatCurrency(item.price)}
              </p>
              {item.notes && (
                <p className="mt-0.5 text-xs italic text-amber-700">Catatan: {item.notes}</p>
              )}
            </div>
            <p className="whitespace-nowrap text-sm font-semibold">
              {formatCurrency(item.price * item.quantity)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TotalsSection({ order }: { order: OrderDetail }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3 text-sm">
      <Row label="Subtotal" value={formatCurrency(order.subtotal)} />
      {order.serviceAmount > 0 && <Row label="Service" value={formatCurrency(order.serviceAmount)} />}
      {order.taxAmount > 0 && <Row label="Pajak" value={formatCurrency(order.taxAmount)} />}
      <div className="mt-2 flex items-center justify-between border-t pt-2 text-base font-bold">
        <span>Total</span>
        <span>{formatCurrency(order.grandTotal)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function TransactionSection({ tx }: { tx: NonNullable<OrderDetail["transaction"]> }) {
  return (
    <div className="rounded-lg border p-3 text-sm">
      <p className="mb-2 text-sm font-semibold">Transaksi Pembayaran</p>
      <div className="space-y-1 text-xs">
        {tx.paymentMethod && <Row label="Metode" value={tx.paymentMethod} />}
        {tx.reference && <Row label="Referensi" value={tx.reference} />}
        {tx.payCode && <Row label="Kode Bayar" value={tx.payCode} />}
        {tx.status && <Row label="Status Tripay" value={tx.status} />}
        {typeof tx.amount === "number" && <Row label="Nominal" value={formatCurrency(tx.amount)} />}
        {tx.expiredTime && <Row label="Kedaluwarsa" value={new Date(tx.expiredTime).toLocaleString("id-ID")} />}
        {tx.paidAt && <Row label="Dibayar" value={new Date(tx.paidAt).toLocaleString("id-ID")} />}
      </div>
    </div>
  );
}
