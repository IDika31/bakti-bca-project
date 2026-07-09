"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem } from "@/components/customer/cart-item";
import { CartSummary } from "@/components/customer/cart-summary";
import { useCart } from "@/hooks/use-cart";

export default function CartPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
        <ShoppingCart className="h-16 w-16 text-muted-foreground/30" />
        <p className="text-muted-foreground">Keranjang kosong</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Lihat Menu
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-28">
      <div className="flex items-center gap-2 py-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">Keranjang</h1>
      </div>

      <div className="space-y-0">
        {items.map((item) => (
          <CartItem key={item.menuItemId} item={item} />
        ))}
      </div>

      <CartSummary />

      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg border-t bg-background p-4">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-shrink-0" onClick={clearCart}>
            Kosongkan
          </Button>
          <Button className="flex-1" size="lg" onClick={() => router.push("/checkout")}>
            Pesan Sekarang
          </Button>
        </div>
      </div>
    </div>
  );
}
