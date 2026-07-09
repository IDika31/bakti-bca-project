import { Suspense } from "react";
import { CartProvider } from "@/hooks/use-cart";
import { TableProvider } from "@/hooks/use-table";
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
          <div className="mx-auto min-h-screen max-w-lg bg-background">
            {children}
            <Toaster position="top-center" />
          </div>
        </TableProvider>
      </Suspense>
    </CartProvider>
  );
}
