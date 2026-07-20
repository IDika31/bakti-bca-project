"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CartItem, CartItemAddon, TaxConfig } from "@/types";

export function itemAddonTotal(addons: CartItemAddon[]): number {
  return addons.reduce((s, a) => s + a.price, 0);
}

// Stable line id: menu + sorted addon ids + notes. Same combo => same line (merged).
function makeLineId(menuItemId: string, addons: CartItemAddon[], notes: string): string {
  const addonKey = addons.map((a) => a.addonId).sort().join(",");
  return `${menuItemId}|${addonKey}|${notes.trim()}`;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "lineId" | "quantity" | "notes"> & { quantity?: number; notes?: string }) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateNotes: (lineId: string, notes: string) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  calculateTotal: (config: TaxConfig) => {
    subtotal: number;
    serviceAmount: number;
    taxAmount: number;
    grandTotal: number;
  };
}

const CartContext = createContext<CartContextType | null>(null);

const CART_KEY = "cart-items";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const stored = sessionStorage.getItem(CART_KEY);
    if (stored) {
      try { setItems(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const persist = useCallback((newItems: CartItem[]) => {
    setItems(newItems);
    sessionStorage.setItem(CART_KEY, JSON.stringify(newItems));
  }, []);

  const addItem: CartContextType["addItem"] = useCallback((item) => {
    const notes = item.notes || "";
    const addons = item.addons || [];
    const lineId = makeLineId(item.menuItemId, addons, notes);

    setItems((prev) => {
      const existing = prev.find((i) => i.lineId === lineId);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map((i) =>
          i.lineId === lineId ? { ...i, quantity: i.quantity + (item.quantity || 1) } : i
        );
      } else {
        updated = [
          ...prev,
          {
            lineId,
            menuItemId: item.menuItemId,
            name: item.name,
            imageUrl: item.imageUrl,
            priceSnapshot: item.priceSnapshot,
            quantity: item.quantity || 1,
            notes,
            addons,
          },
        ];
      }
      sessionStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.lineId !== lineId);
      sessionStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(lineId);
      return;
    }
    setItems((prev) => {
      const updated = prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i));
      sessionStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [removeItem]);

  const updateNotes = useCallback((lineId: string, notes: string) => {
    setItems((prev) => {
      const updated = prev.map((i) => (i.lineId === lineId ? { ...i, notes } : i));
      sessionStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => persist([]), [persist]);

  const lineTotal = (i: CartItem) => (i.priceSnapshot + itemAddonTotal(i.addons)) * i.quantity;

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + lineTotal(i), 0);

  const calculateTotal = useCallback(
    (config: TaxConfig) => {
      const sub = items.reduce((sum, i) => sum + lineTotal(i), 0);
      const serviceAmount = config.serviceEnabled
        ? Math.round(sub * (config.servicePercentage / 100))
        : 0;
      const taxAmount = config.taxEnabled
        ? Math.round(sub * (config.taxPercentage / 100))
        : 0;
      return { subtotal: sub, serviceAmount, taxAmount, grandTotal: sub + serviceAmount + taxAmount };
    },
    [items]
  );

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, updateNotes, clearCart, itemCount, subtotal, calculateTotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
