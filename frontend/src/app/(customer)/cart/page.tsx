"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CartItem } from "@/components/customer/cart-item";
import { CartSummary } from "@/components/customer/cart-summary";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";

export default function CartPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClear = () => {
    clearCart();
    setConfirmClear(false);
    toast.success("Keranjang dikosongkan");
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-5 px-4 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/40 shadow-inner">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
          </div>
        </div>
        <div>
          <p className="text-lg font-semibold">Keranjang kosong</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Yuk pilih menu favoritmu!
          </p>
        </div>
        <Button
          onClick={() => router.push("/")}
          className="mt-2 rounded-full px-8 shadow-lg shadow-primary/25 active:scale-95"
          size="lg"
        >
          Lihat Menu
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6 md:px-8">
          <button
            onClick={() => router.back()}
            aria-label="Kembali"
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold sm:text-xl">Keranjang</h1>
          <span className="ml-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {items.length} item
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 md:px-8">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:gap-8">
          <div className="space-y-3">
            {items.map((item) => (
              <CartItem key={item.lineId} item={item} />
            ))}
          </div>

          <div className="lg:sticky lg:top-20 lg:h-fit">
            <CartSummary />

            <div className="mt-4 hidden gap-2 lg:flex">
              <Button
                variant="outline"
                className="rounded-xl active:scale-95"
                onClick={() => setConfirmClear(true)}
              >
                Kosongkan
              </Button>
              <Button
                className="flex-1 rounded-xl shadow-lg shadow-primary/20 active:scale-[0.97]"
                size="lg"
                onClick={() => router.push("/checkout")}
              >
                Pesan Sekarang
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-4 backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            variant="outline"
            className="flex-shrink-0 rounded-xl active:scale-95"
            onClick={() => setConfirmClear(true)}
          >
            Kosongkan
          </Button>
          <Button
            className="flex-1 rounded-xl shadow-lg shadow-primary/25 active:scale-[0.97]"
            size="lg"
            onClick={() => router.push("/checkout")}
          >
            Pesan Sekarang
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Kosongkan Keranjang?"
        description={`Hapus semua ${items.length} item dari keranjang?`}
        confirmLabel="Ya, Kosongkan"
        variant="destructive"
        onConfirm={handleClear}
      />
    </div>
  );
}
