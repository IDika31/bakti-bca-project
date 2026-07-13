"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, ChefHat, Package, XCircle, Printer, RotateCcw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import type { Order, ApiResponse, PaymentInstruction } from "@/types";

const STEP_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; ring: string }> = {
  PENDING: { icon: <Clock className="h-6 w-6" />, color: "text-slate-700", bg: "bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200", ring: "ring-slate-200" },
  CONFIRMED: { icon: <CheckCircle2 className="h-6 w-6" />, color: "text-emerald-700", bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200", ring: "ring-emerald-200" },
  PREPARING: { icon: <ChefHat className="h-6 w-6" />, color: "text-primary", bg: "bg-gradient-to-br from-primary/5 to-primary/15 border-primary/25", ring: "ring-primary/25" },
  READY: { icon: <Package className="h-6 w-6" />, color: "text-emerald-700", bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200", ring: "ring-emerald-200" },
  COMPLETED: { icon: <CheckCircle2 className="h-6 w-6" />, color: "text-emerald-800", bg: "bg-gradient-to-br from-emerald-50 to-primary/10 border-emerald-200", ring: "ring-emerald-200" },
  CANCELLED: { icon: <XCircle className="h-6 w-6" />, color: "text-red-700", bg: "bg-gradient-to-br from-red-50 to-red-100/50 border-red-200", ring: "ring-red-200" },
};

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [instructions, setInstructions] = useState<PaymentInstruction[]>([]);
  const [openInstruction, setOpenInstruction] = useState<number>(0);

  const fetcher = useCallback(
    () => api.get<ApiResponse<Order>>(`/api/orders/${id}`).then((r) => r.data),
    [id]
  );

  const { data: order, loading } = usePolling(fetcher, 5000, {
    stopWhen: (o) => ["COMPLETED", "CANCELLED"].includes(o.orderStatus),
  });

  useEffect(() => {
    if (!order?.transaction || order.paymentStatus !== "UNPAID") return;
    const tx = order.transaction;
    const params = new URLSearchParams({ code: tx.paymentMethod });
    if (tx.payCode) params.set("pay_code", tx.payCode);
    if (tx.amount) params.set("amount", String(tx.amount));

    api.get<ApiResponse<PaymentInstruction[]>>(`/api/payment-instructions?${params.toString()}`)
      .then((r) => setInstructions(r.data || []))
      .catch(() => {});
  }, [order?.transaction?.paymentMethod, order?.paymentStatus]);

  if (loading && !order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Pesanan tidak ditemukan</p>
        <Button onClick={() => router.push("/")} className="rounded-full px-6">
          Kembali ke Menu
        </Button>
      </div>
    );
  }

  const steps = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];
  const currentIdx = steps.indexOf(order.orderStatus);
  const config = STEP_CONFIG[order.orderStatus] || STEP_CONFIG.PENDING;

  return (
    <div className="pb-8 print:px-0">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-lg print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6 md:px-8">
          <button
            onClick={() => router.push("/")}
            aria-label="Kembali"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold sm:text-xl">Status Pesanan</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 md:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:gap-8">
          {/* Left column */}
          <div className="space-y-4">
            {/* Status card */}
            <div className={`rounded-2xl border p-5 shadow-sm ${config.bg} sm:p-6`}>
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-md ring-4 ${config.ring} ${config.color} sm:h-16 sm:w-16`}>
                  {config.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-lg font-bold sm:text-2xl ${config.color}`}>
                    {ORDER_STATUS_LABELS[order.orderStatus]}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {order.orderNumber}
                  </p>
                </div>
                <div className="hidden rounded-full border bg-white px-3 py-1 text-xs font-medium shadow-sm sm:block">
                  {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                </div>
              </div>

              {/* Progress bar */}
              {order.orderStatus !== "CANCELLED" && (
                <div className="mt-6 flex gap-1.5">
                  {steps.map((step, i) => (
                    <div
                      key={step}
                      className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                        i <= currentIdx
                          ? "bg-primary shadow-sm shadow-primary/40"
                          : "bg-white/80"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Cashier payment info */}
            {!order.transaction && order.paymentStatus === "UNPAID" && (
              <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm print:hidden sm:p-6">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
                    💰
                  </div>
                  <p className="text-base font-bold text-amber-900">
                    Silakan bayar di kasir
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    Sebutkan nomor pesanan <span className="font-bold">{order.orderNumber}</span>
                    {order.table && (
                      <> atau <span className="font-bold">{order.table.name || `Meja ${order.table.number}`}</span></>
                    )}
                    {order.customerName && !order.table && (
                      <> atas nama <span className="font-bold">{order.customerName}</span></>
                    )}
                  </p>
                  <p className="mt-3 text-lg font-bold text-amber-900">
                    {formatCurrency(order.grandTotal)}
                  </p>
                </div>

                <Separator className="my-4 bg-amber-200" />

                <div className="space-y-2 text-left text-sm text-amber-800">
                  <p className="font-semibold">Langkah pembayaran:</p>
                  <ol className="list-inside list-decimal space-y-1.5 pl-1">
                    <li>Menuju ke kasir restoran</li>
                    <li>Sebutkan nomor pesanan <span className="font-bold">{order.orderNumber}</span></li>
                    <li>Lakukan pembayaran tunai atau kartu debit</li>
                    <li>Tunggu konfirmasi dari kasir</li>
                    <li>Pesanan akan segera diproses setelah pembayaran dikonfirmasi</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Online payment info */}
            {order.transaction && order.paymentStatus === "UNPAID" && (
              <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-emerald-50 p-5 shadow-sm print:hidden sm:p-6">
                <p className="text-center text-sm font-medium text-primary">
                  Selesaikan pembayaran sebelum
                </p>
                <p className="mt-1 text-center font-mono text-sm font-bold text-primary sm:text-base">
                  {formatDate(order.transaction.expiredTime)}
                </p>

                <p className="mt-3 text-center text-lg font-bold text-foreground">
                  {formatCurrency(order.grandTotal)}
                </p>

                {order.transaction.payCode && (
                  <div className="mt-4 rounded-2xl border border-primary/15 bg-white p-4 shadow-inner">
                    <p className="text-center text-xs text-muted-foreground">Kode Bayar</p>
                    <p className="mt-1 select-all break-all text-center font-mono text-2xl font-bold tracking-wider text-foreground sm:text-3xl">
                      {order.transaction.payCode}
                    </p>
                  </div>
                )}
                {order.transaction.qrUrl && (
                  <div className="mt-4 text-center">
                    <div className="inline-block rounded-2xl border border-primary/15 bg-white p-3 shadow-inner">
                      <img
                        src={order.transaction.qrUrl}
                        alt="QR Payment"
                        className="h-48 w-48 sm:h-56 sm:w-56"
                      />
                    </div>
                  </div>
                )}

                {/* Payment instructions from Tripay */}
                {instructions.length > 0 && (
                  <div className="mt-5 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Cara Pembayaran</p>
                    {instructions.map((inst, idx) => (
                      <div key={idx} className="overflow-hidden rounded-xl border border-primary/10 bg-white">
                        <button
                          onClick={() => setOpenInstruction(openInstruction === idx ? -1 : idx)}
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50"
                        >
                          {inst.title}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openInstruction === idx ? "rotate-180" : ""}`} />
                        </button>
                        {openInstruction === idx && (
                          <div className="border-t px-4 py-3">
                            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                              {inst.steps.map((step, si) => (
                                <li key={si} dangerouslySetInnerHTML={{ __html: step }} />
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Order details */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Waktu</span>
                  <span className="font-medium">{formatDate(order.createdAt)}</span>
                </div>
                {order.table && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Meja</span>
                    <span className="font-medium">
                      {order.table.name || `Meja ${order.table.number}`}
                    </span>
                  </div>
                )}
                {order.customerName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Nama</span>
                    <span className="font-medium">{order.customerName}</span>
                  </div>
                )}
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">
                        {item.quantity}x {item.menuItem.name}
                      </span>
                      {item.notes && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          📝 {item.notes}
                        </p>
                      )}
                    </div>
                    <span className="whitespace-nowrap font-medium tabular-nums">
                      {formatCurrency(item.priceSnapshot * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.serviceAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Service ({Number(order.servicePercent)}%)</span>
                    <span className="tabular-nums">{formatCurrency(order.serviceAmount)}</span>
                  </div>
                )}
                {order.taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>PB1 ({Number(order.taxPercent)}%)</span>
                    <span className="tabular-nums">{formatCurrency(order.taxAmount)}</span>
                  </div>
                )}
                <div className="border-t border-dashed pt-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-lg font-bold tabular-nums text-primary sm:text-xl">
                      {formatCurrency(order.grandTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action sidebar */}
          <div className="lg:sticky lg:top-20 lg:h-fit">
            <div className="flex gap-3 print:hidden lg:flex-col">
              <Button
                variant="outline"
                className="flex-1 gap-2 rounded-xl"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                Cetak
              </Button>
              <Button
                className="flex-1 gap-2 rounded-xl shadow-lg shadow-primary/20"
                onClick={() => router.push("/")}
              >
                <RotateCcw className="h-4 w-4" />
                Pesan Lagi
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
