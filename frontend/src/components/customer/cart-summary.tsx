"use client";

import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { useCart } from "@/hooks/use-cart";
import { api } from "@/lib/api";
import type { TaxConfig, ApiResponse } from "@/types";

export function CartSummary() {
  const { subtotal, calculateTotal } = useCart();
  const [config, setConfig] = useState<TaxConfig | null>(null);

  useEffect(() => {
    api.get<ApiResponse<TaxConfig>>("/api/tax-config").then((res) => setConfig(res.data)).catch(() => {});
  }, []);

  const totals = config
    ? calculateTotal(config)
    : { subtotal, serviceAmount: 0, taxAmount: 0, grandTotal: subtotal };

  return (
    <div className="space-y-2 pt-2">
      <Separator />
      <div className="flex justify-between text-sm">
        <span>Subtotal</span>
        <span>{formatCurrency(totals.subtotal)}</span>
      </div>
      {config?.serviceEnabled && totals.serviceAmount > 0 && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{config.serviceLabel} ({Number(config.servicePercentage)}%)</span>
          <span>{formatCurrency(totals.serviceAmount)}</span>
        </div>
      )}
      {config?.taxEnabled && totals.taxAmount > 0 && (
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{config.taxLabel} ({Number(config.taxPercentage)}%)</span>
          <span>{formatCurrency(totals.taxAmount)}</span>
        </div>
      )}
      <Separator />
      <div className="flex justify-between text-base font-bold">
        <span>Total</span>
        <span>{formatCurrency(totals.grandTotal)}</span>
      </div>
    </div>
  );
}
