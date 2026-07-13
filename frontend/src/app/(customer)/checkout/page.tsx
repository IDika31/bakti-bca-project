"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CreditCard, User, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CartSummary } from "@/components/customer/cart-summary";
import { useCart } from "@/hooks/use-cart";
import { useTable } from "@/hooks/use-table";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import type { PaymentMethod, TaxConfig, ApiResponse } from "@/types";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart, calculateTotal } = useCart();
  const { table, isDineIn } = useTable();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [taxConfig, setTaxConfig] = useState<TaxConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (items.length === 0 && !redirecting) {
      router.replace("/");
      return;
    }
    Promise.all([
      api.get<ApiResponse<PaymentMethod[]>>("/api/payment-methods"),
      api.get<ApiResponse<TaxConfig>>("/api/tax-config"),
    ]).then(([pmRes, taxRes]) => {
      setPaymentMethods(pmRes.data);
      setTaxConfig(taxRes.data);
    });
  }, [items.length, router]);

  const handleSubmit = async () => {
    if (!isDineIn && !customerName.trim()) {
      toast.error("Masukkan nama pemesan");
      return;
    }
    if (!selectedMethod) {
      toast.error("Pilih metode pembayaran");
      return;
    }

    setSubmitting(true);
    try {
      let sessionId = sessionStorage.getItem("session-id");
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem("session-id", sessionId);
      }

      const tableInfo = sessionStorage.getItem("table-info");
      const tableToken = tableInfo ? JSON.parse(tableInfo).token : undefined;

      const res = await api.post<ApiResponse<{ orderId: string; transaction: { checkoutUrl?: string; reference: string } }>>(
        "/api/checkout",
        {
          sessionId,
          orderType: isDineIn ? "DINE_IN" : "TAKE_AWAY",
          tableToken,
          customerName: isDineIn ? undefined : customerName,
          customerEmail: customerEmail || undefined,
          paymentMethodCode: selectedMethod,
          items: items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            priceSnapshot: item.priceSnapshot,
            notes: item.notes || undefined,
          })),
        }
      );

      setRedirecting(true);

      const { orderId, transaction } = res.data;
      if (transaction.checkoutUrl) {
        clearCart();
        window.location.href = transaction.checkoutUrl;
      } else {
        router.push(`/order/${orderId}`);
        setTimeout(() => clearCart(), 100);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pesanan");
      setSubmitting(false);
    }
  };

  const grouped = paymentMethods.reduce<Record<string, PaymentMethod[]>>((acc, pm) => {
    (acc[pm.groupName] ??= []).push(pm);
    return acc;
  }, {});

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6 md:px-8">
          <button
            onClick={() => router.back()}
            aria-label="Kembali"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold sm:text-xl">Checkout</h1>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:gap-8">
          {/* Form column */}
          <div className="space-y-5">
            {/* Table / Name section */}
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="border-b border-border/60 bg-muted/30 px-4 py-2.5 sm:px-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <User className="h-4 w-4 text-primary" />
                  {isDineIn ? "Informasi Meja" : "Informasi Pemesan"}
                </h2>
              </div>
              <div className="p-4 sm:p-5">
                {isDineIn && table ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                      📍
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Meja</p>
                      <p className="text-lg font-bold text-primary">
                        {table.name || `Meja ${table.number}`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">
                      Nama Pemesan *
                    </Label>
                    <Input
                      id="name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nama untuk dipanggil"
                      className="mt-2 rounded-xl"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Email */}
            <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="border-b border-border/60 bg-muted/30 px-4 py-2.5 sm:px-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Mail className="h-4 w-4 text-primary" />
                  Email (Opsional)
                </h2>
              </div>
              <div className="p-4 sm:p-5">
                <Input
                  id="email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="nama@email.com — untuk menerima struk digital"
                  className="rounded-xl"
                />
              </div>
            </section>

            {/* Payment methods */}
            <section>
              <div className="mb-3 flex items-center gap-2 px-1">
                <CreditCard className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Metode Pembayaran *</Label>
              </div>
              <div className="space-y-5">
                {Object.entries(grouped).map(([group, methods]) => (
                  <div key={group}>
                    <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {methods.map((pm) => (
                        <button
                          key={pm.id}
                          onClick={() => setSelectedMethod(pm.code)}
                          className={`group flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                            selectedMethod === pm.code
                              ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                              : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                          }`}
                        >
                          {pm.iconUrl ? (
                            <img
                              src={pm.iconUrl}
                              alt={pm.name}
                              className="h-8 w-auto object-contain"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <CreditCard className="h-4 w-4" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{pm.name}</p>
                            {pm.feeCustomer > 0 && (
                              <p className="text-xs text-muted-foreground">
                                + {formatCurrency(pm.feeCustomer)} biaya
                              </p>
                            )}
                          </div>
                          <div
                            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              selectedMethod === pm.code
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/30"
                            }`}
                          >
                            {selectedMethod === pm.code && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Summary column */}
          <div className="lg:sticky lg:top-20 lg:h-fit">
            <CartSummary />

            <Button
              className="mt-4 hidden w-full rounded-xl text-base shadow-lg shadow-primary/25 lg:flex"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Bayar Sekarang
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-4 backdrop-blur-lg lg:hidden">
        <div className="mx-auto max-w-lg">
          <Button
            className="w-full rounded-xl text-base shadow-lg shadow-primary/25"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Bayar Sekarang
          </Button>
        </div>
      </div>
    </div>
  );
}
