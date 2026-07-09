"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    if (items.length === 0) {
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

      clearCart();

      const { orderId, transaction } = res.data;
      if (transaction.checkoutUrl) {
        window.location.href = transaction.checkoutUrl;
      } else {
        router.push(`/order/${orderId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membuat pesanan");
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = paymentMethods.reduce<Record<string, PaymentMethod[]>>((acc, pm) => {
    (acc[pm.groupName] ??= []).push(pm);
    return acc;
  }, {});

  return (
    <div className="px-4 pb-28">
      <div className="flex items-center gap-2 py-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">Checkout</h1>
      </div>

      <div className="space-y-4">
        {isDineIn && table ? (
          <div>
            <Label>Meja</Label>
            <div className="mt-1">
              <Badge variant="secondary" className="text-sm">
                📍 {table.name || `Meja ${table.number}`}
              </Badge>
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor="name">Nama Pemesan *</Label>
            <Input
              id="name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nama untuk dipanggil"
              className="mt-1"
            />
          </div>
        )}

        <div>
          <Label htmlFor="email">Email (opsional)</Label>
          <Input
            id="email"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="Untuk menerima struk digital"
            className="mt-1"
          />
        </div>

        <div>
          <Label>Metode Pembayaran *</Label>
          <div className="mt-2 space-y-3">
            {Object.entries(grouped).map(([group, methods]) => (
              <div key={group}>
                <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">{group}</p>
                <div className="space-y-1.5">
                  {methods.map((pm) => (
                    <Card
                      key={pm.id}
                      className={`cursor-pointer transition-colors ${selectedMethod === pm.code ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={() => setSelectedMethod(pm.code)}
                    >
                      <CardContent className="flex items-center gap-3 p-3">
                        {pm.iconUrl && (
                          <img src={pm.iconUrl} alt={pm.name} className="h-6 w-auto" />
                        )}
                        <span className="flex-1 text-sm font-medium">{pm.name}</span>
                        {pm.feeCustomer > 0 && (
                          <span className="text-xs text-muted-foreground">
                            + {formatCurrency(pm.feeCustomer)}
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <CartSummary />
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg border-t bg-background p-4">
        <Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Bayar Sekarang
        </Button>
      </div>
    </div>
  );
}
