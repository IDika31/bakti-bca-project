"use client";

import { useEffect, useState } from "react";
import { ShoppingCart, ChevronRight } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { formatCurrency } from "@/lib/format";

interface CartFabProps {
  onClick: () => void;
}

export function CartFab({ onClick }: CartFabProps) {
  const { itemCount, subtotal } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || itemCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300 sm:bottom-6 sm:left-6 sm:right-6">
      <div className="mx-auto max-w-2xl">
        <button
          onClick={onClick}
          className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary to-emerald-700 px-5 py-4 text-primary-foreground shadow-2xl shadow-primary/40 transition-all duration-200 hover:shadow-primary/50 active:scale-[0.98] sm:px-6 sm:py-4"
        >
          {/* Shine effect */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

          <div className="relative">
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary shadow-md">
              {itemCount}
            </span>
          </div>
          <div className="relative flex flex-1 flex-col items-start">
            <span className="text-xs opacity-90">
              {itemCount} item di keranjang
            </span>
            <span className="text-sm font-semibold sm:text-base">Lihat Keranjang</span>
          </div>
          <span className="relative text-base font-bold sm:text-lg">
            {formatCurrency(subtotal)}
          </span>
          <ChevronRight className="relative h-5 w-5 opacity-70 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}
