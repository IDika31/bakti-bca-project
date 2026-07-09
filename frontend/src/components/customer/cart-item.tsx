"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { useCart } from "@/hooks/use-cart";
import type { CartItem as CartItemType } from "@/types";

export function CartItem({ item }: { item: CartItemType }) {
  const { updateQuantity, updateNotes, removeItem } = useCart();

  return (
    <div className="flex flex-col gap-2 border-b py-3 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">{formatCurrency(item.priceSnapshot)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={() => removeItem(item.menuItemId)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <Textarea
        placeholder="Catatan (misal: tidak pedas)"
        value={item.notes}
        onChange={(e) => updateNotes(item.menuItemId, e.target.value)}
        className="min-h-[36px] resize-none text-xs"
        rows={1}
      />
      <p className="text-right text-sm font-semibold">
        {formatCurrency(item.priceSnapshot * item.quantity)}
      </p>
    </div>
  );
}
