"use client";

import { useEffect, useState } from "react";
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
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
      <div className="border-b border-dashed border-border/60 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-muted-foreground">Ringkasan</h3>
      </div>
      <div className="space-y-2.5 px-4 py-4 text-sm sm:px-5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{formatCurrency(totals.subtotal)}</span>
        </div>
        {config?.serviceEnabled && totals.serviceAmount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>{config.serviceLabel} ({Number(config.servicePercentage)}%)</span>
            <span className="tabular-nums">{formatCurrency(totals.serviceAmount)}</span>
          </div>
        )}
        {config?.taxEnabled && totals.taxAmount > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>{config.taxLabel} ({Number(config.taxPercentage)}%)</span>
            <span className="tabular-nums">{formatCurrency(totals.taxAmount)}</span>
          </div>
        )}
      </div>
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 px-4 py-3 sm:px-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Total Bayar</span>
          <span className="text-xl font-bold text-primary tabular-nums sm:text-2xl">
            {formatCurrency(totals.grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}
