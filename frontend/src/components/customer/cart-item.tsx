"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useCart } from "@/hooks/use-cart";
import type { CartItem as CartItemType } from "@/types";

export function CartItem({ item }: { item: CartItemType }) {
  const { updateQuantity, updateNotes, removeItem } = useCart();

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight sm:text-lg">{item.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCurrency(item.priceSnapshot)} <span className="text-xs">/ item</span>
          </p>
        </div>
        <button
          onClick={() => removeItem(item.menuItemId)}
          aria-label="Hapus item"
          className="flex-shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {/* Qty controls */}
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-background p-1">
          <button
            onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
            aria-label="Kurang"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">
            {item.quantity}
          </span>
          <button
            onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
            aria-label="Tambah"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-base font-bold text-primary sm:text-lg">
          {formatCurrency(item.priceSnapshot * item.quantity)}
        </span>
      </div>

      <textarea
        placeholder="Catatan (misal: tidak pedas, tanpa es)"
        value={item.notes}
        onChange={(e) => updateNotes(item.menuItemId, e.target.value)}
        className="mt-3 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs transition-colors placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:text-sm"
        rows={1}
      />
    </div>
  );
}
