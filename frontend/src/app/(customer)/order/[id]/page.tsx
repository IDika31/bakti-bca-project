"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, ChefHat, Package, XCircle, Printer, RotateCcw, ChevronDown, Copy, Check, CreditCard, Banknote, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePolling } from "@/hooks/use-polling";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/format";
import { toast } from "sonner";
import type { Order, ApiResponse, PaymentInstruction } from "@/types";

const STEPS = [
  { key: "PENDING", label: "Menunggu", icon: Clock, color: "text-amber-600" },
  { key: "CONFIRMED", label: "Diterima", icon: CheckCircle2, color: "text-blue-600" },
  { key: "PREPARING", label: "Diproses", icon: ChefHat, color: "text-orange-600" },
  { key: "READY", label: "Siap", icon: Package, color: "text-emerald-600" },
  { key: "COMPLETED", label: "Selesai", icon: CheckCircle2, color: "text-emerald-700" },
];

const STATUS_THEMES: Record<string, { gradient: string; border: string; text: string; badge: string }> = {
  PENDING: { gradient: "from-amber-50 via-orange-50/50 to-amber-50/30", border: "border-amber-200/80", text: "text-amber-800", badge: "bg-amber-100 text-amber-800" },
  CONFIRMED: { gradient: "from-blue-50 via-sky-50/50 to-blue-50/30", border: "border-blue-200/80", text: "text-blue-800", badge: "bg-blue-100 text-blue-800" },
  PREPARING: { gradient: "from-orange-50 via-amber-50/50 to-orange-50/30", border: "border-orange-200/80", text: "text-orange-800", badge: "bg-orange-100 text-orange-800" },
  READY: { gradient: "from-emerald-50 via-green-50/50 to-emerald-50/30", border: "border-emerald-200/80", text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-800" },
  COMPLETED: { gradient: "from-emerald-50 via-primary/5 to-emerald-50/30", border: "border-emerald-200/80", text: "text-emerald-800", badge: "bg-emerald-100 text-emerald-800" },
  CANCELLED: { gradient: "from-red-50 via-rose-50/50 to-red-50/30", border: "border-red-200/80", text: "text-red-800", badge: "bg-red-100 text-red-800" },
};

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [instructions, setInstructions] = useState<PaymentInstruction[]>([]);
  const [openInstruction, setOpenInstruction] = useState<number>(0);
  const [copied, setCopied] = useState(false);

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
      .catch(() => { /* payment instructions optional */ });
  }, [order?.transaction?.paymentMethod, order?.paymentStatus]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

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
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-4xl">
          🔍
        </div>
        <p className="text-lg font-semibold">Pesanan tidak ditemukan</p>
        <p className="text-sm text-muted-foreground">Mungkin pesanan sudah kadaluarsa atau link salah</p>
        <Button onClick={() => router.push("/")} className="mt-2 rounded-full px-8 active:scale-95" size="lg">
          Kembali ke Menu
        </Button>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === order.orderStatus);
  const theme = STATUS_THEMES[order.orderStatus] || STATUS_THEMES.PENDING;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background pb-8 print:bg-white print:px-0">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-lg print:hidden">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6 md:px-8">
          <button
            onClick={() => router.push("/")}
            aria-label="Kembali"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-muted active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold sm:text-xl">Status Pesanan</h1>
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${theme.badge}`}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:gap-8">
          {/* Left column */}
          <div className="space-y-5">
            {/* Status card */}
            <div className={`overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.gradient} shadow-sm`}>
              <div className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg ${theme.text} sm:h-16 sm:w-16`}>
                    {(() => {
                      if (order.orderStatus === "CANCELLED") return <XCircle className="h-7 w-7" />;
                      const CurrentIcon = STEPS[currentIdx]?.icon ?? Clock;
                      return <CurrentIcon className="h-7 w-7" />;
                    })()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xl font-bold sm:text-2xl ${theme.text}`}>
                      {ORDER_STATUS_LABELS[order.orderStatus]}
                    </p>
                    <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                      #{order.orderNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step timeline */}
              {order.orderStatus !== "CANCELLED" && (
                <div className="border-t border-white/60 bg-white/40 px-5 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    {STEPS.map((step, i) => {
                      const StepIcon = step.icon;
                      const isActive = i <= currentIdx;
                      const isCurrent = i === currentIdx;
                      return (
                        <div key={step.key} className="flex flex-1 items-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-500 ${
                              isCurrent ? "scale-110 bg-primary text-white shadow-lg shadow-primary/30"
                              : isActive ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground/40"
                            }`}>
                              <StepIcon className="h-4 w-4" />
                            </div>
                            <span className={`hidden text-[10px] font-medium sm:block ${
                              isActive ? "text-foreground" : "text-muted-foreground/50"
                            }`}>
                              {step.label}
                            </span>
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className={`mx-1 h-0.5 flex-1 rounded-full transition-all duration-500 ${
                              i < currentIdx ? "bg-primary" : "bg-muted"
                            }`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Cashier payment */}
            {!order.transaction && order.paymentStatus === "UNPAID" && (
              <div className="overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50/80 to-amber-50/60 shadow-sm print:hidden">
                <div className="flex items-center gap-3 border-b border-amber-200/60 bg-amber-100/50 px-5 py-3">
                  <Banknote className="h-5 w-5 text-amber-700" />
                  <h3 className="text-sm font-bold text-amber-900">Pembayaran di Kasir</h3>
                </div>
                <div className="p-5 sm:p-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-amber-900">{formatCurrency(order.grandTotal)}</p>
                    <p className="mt-2 text-sm text-amber-700">
                      Sebutkan nomor pesanan{" "}
                      <button
                        onClick={() => copyToClipboard(order.orderNumber)}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-200/60 px-2 py-0.5 font-bold transition-colors hover:bg-amber-200 active:scale-95"
                      >
                        {order.orderNumber}
                        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </p>
                    {order.table && (
                      <p className="mt-1 text-sm text-amber-700">
                        atau <span className="font-bold">{order.table.name || `Meja ${order.table.number}`}</span>
                      </p>
                    )}
                  </div>

                  <Separator className="my-4 bg-amber-200/60" />

                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Langkah pembayaran</p>
                    <div className="space-y-2.5">
                      {[
                        "Menuju ke kasir restoran",
                        `Sebutkan nomor pesanan ${order.orderNumber}`,
                        "Lakukan pembayaran tunai atau kartu debit",
                        "Tunggu konfirmasi dari kasir",
                        "Pesanan akan segera diproses",
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-xs font-bold text-amber-900">
                            {i + 1}
                          </span>
                          <p className="pt-0.5 text-sm text-amber-800">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Online payment */}
            {order.transaction && order.paymentStatus === "UNPAID" && (
              <div className="overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-emerald-50/80 to-primary/5 shadow-sm print:hidden">
                <div className="flex items-center gap-3 border-b border-primary/10 bg-primary/5 px-5 py-3">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold text-primary">Detail Pembayaran</h3>
                </div>
                <div className="p-5 sm:p-6">
                  {/* Amount + expiry */}
                  <div className="text-center">
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(order.grandTotal)}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Bayar sebelum{" "}
                      <span className="font-semibold text-red-600">{formatDate(order.transaction.expiredTime)}</span>
                    </p>
                  </div>

                  {/* Pay code */}
                  {order.transaction.payCode && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-inner">
                      <div className="bg-muted/30 px-4 py-2 text-center text-xs font-medium text-muted-foreground">
                        Kode Bayar / Nomor Virtual Account
                      </div>
                      <div className="px-4 py-4 text-center">
                        <p className="select-all break-all font-mono text-2xl font-bold tracking-widest text-foreground sm:text-3xl">
                          {order.transaction.payCode}
                        </p>
                        <button
                          onClick={() => copyToClipboard(order.transaction!.payCode!)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/20 active:scale-95"
                        >
                          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copied ? "Disalin!" : "Salin Kode"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* QR */}
                  {order.transaction.qrUrl && (
                    <div className="mt-5 text-center">
                      <div className="inline-block overflow-hidden rounded-2xl border border-primary/15 bg-white p-4 shadow-inner">
                        <img
                          src={order.transaction.qrUrl}
                          alt="QR Payment"
                          className="h-48 w-48 sm:h-56 sm:w-56"
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Scan QR untuk membayar</p>
                    </div>
                  )}

                  {/* Instructions accordion */}
                  {instructions.length > 0 && (
                    <div className="mt-6">
                      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Cara Pembayaran</p>
                      <div className="space-y-2">
                        {instructions.map((inst, idx) => (
                          <div key={idx} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                            <button
                              onClick={() => setOpenInstruction(openInstruction === idx ? -1 : idx)}
                              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold transition-colors hover:bg-muted/50 active:bg-muted"
                            >
                              {inst.title}
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openInstruction === idx ? "rotate-180" : ""}`} />
                            </button>
                            {openInstruction === idx && (
                              <div className="border-t bg-muted/20 px-4 py-4">
                                <div className="space-y-2.5">
                                  {inst.steps.map((step, si) => (
                                    <div key={si} className="flex items-start gap-3">
                                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                                        {si + 1}
                                      </span>
                                      <p className="pt-0.5 text-sm text-muted-foreground" dangerouslySetInnerHTML={{ __html: step }} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Paid success banner */}
            {order.paymentStatus === "PAID" && (
              <div className="flex items-center gap-3 rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-5 shadow-sm print:hidden">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
                  ✅
                </div>
                <div>
                  <p className="font-bold text-emerald-900">Pembayaran Berhasil</p>
                  <p className="text-sm text-emerald-700">Pesanan kamu sedang diproses</p>
                </div>
              </div>
            )}

            {/* Order details */}
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="border-b border-border/60 bg-muted/30 px-5 py-3">
                <h3 className="text-sm font-bold">Detail Pesanan</h3>
              </div>
              <div className="p-5 sm:p-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Waktu</span>
                    <span className="font-medium">{formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipe</span>
                    <span className="font-medium">{order.orderType === "DINE_IN" ? "Makan di Tempat" : "Bawa Pulang"}</span>
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
                            <StickyNote className="mr-1 inline h-3 w-3" />{item.notes}
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
          </div>

          {/* Action sidebar */}
          <div className="lg:sticky lg:top-20 lg:h-fit">
            <div className="flex gap-3 print:hidden lg:flex-col">
              <Button
                variant="outline"
                className="flex-1 gap-2 rounded-xl transition-all active:scale-95"
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />
                Cetak
              </Button>
              <Button
                className="flex-1 gap-2 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
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
