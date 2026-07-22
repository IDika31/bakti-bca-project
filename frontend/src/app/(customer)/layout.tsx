import { Suspense } from "react";
import { CartProvider } from "@/hooks/use-cart";
import { TableProvider } from "@/hooks/use-table";
import { TableLockGate } from "@/components/table-lock-gate";
import { Toaster } from "@/components/ui/sonner";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <Suspense>
        <TableProvider>
          <div className="relative min-h-screen bg-background">
            {/* Decorative background — desktop only */}
            <div
              aria-hidden
              className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden lg:block"
            >
              <div className="absolute -left-40 top-0 h-[32rem] w-[32rem] rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-700/10" />
              <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-lime-200/20 blur-3xl dark:bg-lime-500/5" />
            </div>
            <TableLockGate>{children}</TableLockGate>
            <Toaster position="top-center" richColors />
          </div>
        </TableProvider>
      </Suspense>
    </CartProvider>
  );
}
