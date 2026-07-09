"use client";

import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/format";

interface CartFabProps {
  onClick: () => void;
}

export function CartFab({ onClick }: CartFabProps) {
  const { itemCount, subtotal } = useCart();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-80 sm:rounded-xl sm:border">
      <Button onClick={onClick} className="w-full gap-2" size="lg">
        <ShoppingCart className="h-5 w-5" />
        <span className="flex-1 text-left">
          {itemCount} item · {formatCurrency(subtotal)}
        </span>
        <span>Lihat →</span>
      </Button>
    </div>
  );
}
