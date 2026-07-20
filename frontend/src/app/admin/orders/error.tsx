"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AdminOrdersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/admin/orders] render error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold">Gagal memuat halaman pesanan</p>
        <p className="text-sm text-muted-foreground">
          {error.message || "Terjadi kesalahan tak terduga."}
        </p>
        {error.digest && (
          <p className="text-[10px] text-muted-foreground/70">ref: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset} className="rounded-xl">
        Coba lagi
      </Button>
    </div>
  );
}
