"use client";

import { useRef } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useCart, itemAddonTotal } from "@/hooks/use-cart";
import { toast } from "sonner";
import type { CartItem as CartItemType } from "@/types";

export function CartItem({ item }: { item: CartItemType }) {
  const { updateQuantity, updateNotes, removeItem, addItem } = useCart();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleRemove = () => {
    const snapshot = { ...item };
    removeItem(item.lineId);
    toast(`${item.name} dihapus`, {
      action: {
        label: "Urungkan",
        onClick: () =>
          addItem({
            menuItemId: snapshot.menuItemId,
            name: snapshot.name,
            imageUrl: snapshot.imageUrl,
            priceSnapshot: snapshot.priceSnapshot,
            quantity: snapshot.quantity,
            notes: snapshot.notes,
            addons: snapshot.addons,
          }),
      },
      duration: 4000,
    });
  };

  const handleQuantityDown = () => {
    if (item.quantity <= 1) {
      handleRemove();
    } else {
      updateQuantity(item.lineId, item.quantity - 1);
    }
  };

  const handleNotesChange = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNotes(item.lineId, value);
    }, 300);
  };

  const addonTotal = itemAddonTotal(item.addons);
  const unitPrice = item.priceSnapshot + addonTotal;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight sm:text-lg">{item.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCurrency(unitPrice)} <span className="text-xs">/ item</span>
          </p>
          {item.addons.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.addons.map((a) => (
                <span
                  key={a.addonId}
                  className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                >
                  + {a.name} ({formatCurrency(a.price)})
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleRemove}
          aria-label="Hapus item"
          className="flex-shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-90"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-0.5 rounded-full border border-border bg-background p-1">
          <button
            onClick={handleQuantityDown}
            aria-label="Kurang"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">
            {item.quantity}
          </span>
          <button
            onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
            aria-label="Tambah"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <span className="text-base font-bold text-primary sm:text-lg">
          {formatCurrency(unitPrice * item.quantity)}
        </span>
      </div>

      <textarea
        placeholder="Catatan (misal: tidak pedas, tanpa es)"
        defaultValue={item.notes}
        onChange={(e) => handleNotesChange(e.target.value)}
        className="mt-3 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs transition-colors placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:text-sm"
        rows={1}
      />
    </div>
  );
}
