"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CartItem, TaxConfig } from "@/types";

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity" | "notes"> & { quantity?: number; notes?: string }) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateNotes: (menuItemId: string, notes: string) => void;
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
    setItems((prev) => {
      const existing = prev.find((i) => i.menuItemId === item.menuItemId);
      let updated: CartItem[];
      if (existing) {
        updated = prev.map((i) =>
          i.menuItemId === item.menuItemId
            ? { ...i, quantity: i.quantity + (item.quantity || 1) }
            : i
        );
      } else {
        updated = [...prev, { ...item, quantity: item.quantity || 1, notes: item.notes || "" }];
      }
      sessionStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeItem = useCallback((menuItemId: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.menuItemId !== menuItemId);
      sessionStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateQuantity = useCallback((menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setItems((prev) => {
      const updated = prev.map((i) => (i.menuItemId === menuItemId ? { ...i, quantity } : i));
      sessionStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [removeItem]);

  const updateNotes = useCallback((menuItemId: string, notes: string) => {
    setItems((prev) => {
      const updated = prev.map((i) => (i.menuItemId === menuItemId ? { ...i, notes } : i));
      sessionStorage.setItem(CART_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => persist([]), [persist]);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0);

  const calculateTotal = useCallback(
    (config: TaxConfig) => {
      const sub = items.reduce((sum, i) => sum + i.priceSnapshot * i.quantity, 0);
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
