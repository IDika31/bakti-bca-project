"use client";

import { UtensilsCrossed, ShoppingBag } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTable } from "@/hooks/use-table";

// Force walk-in customers (no table QR) to pick Dine-In vs Take-Away before
// browsing the menu, so the cashier knows how to route the order.
export function OrderTypeGate({ children }: { children: React.ReactNode }) {
  const { loading, table, orderType, setOrderType } = useTable();
  const pathname = usePathname();

  // Don't gate viewing an existing order — user might land on /order/<id> from
  // a link and shouldn't be forced to pick a type just to see status.
  const skipGate = pathname?.startsWith("/order/") ?? false;

  const needsChoice = !skipGate && !loading && !table && !orderType;

  if (needsChoice) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-lg sm:p-8">
          <div className="text-center">
            <h1 className="text-xl font-bold sm:text-2xl">Pilih Tipe Pesanan</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Apakah kamu makan di tempat atau mau dibawa pulang?
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setOrderType("DINE_IN")}
              className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-border p-5 transition-all hover:-translate-y-1 hover:border-primary hover:bg-primary/5 hover:shadow-lg active:scale-95"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <UtensilsCrossed className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold">Makan di Tempat</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Disajikan di meja / kursi resto
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setOrderType("TAKE_AWAY")}
              className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-border p-5 transition-all hover:-translate-y-1 hover:border-primary hover:bg-primary/5 hover:shadow-lg active:scale-95"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <ShoppingBag className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold">Bungkus</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Take-away, dibawa pulang
                </p>
              </div>
            </button>
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Pilihan bisa diubah nanti dengan me-refresh halaman.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
