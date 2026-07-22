"use client";

import { Lock } from "lucide-react";
import { useTable } from "@/hooks/use-table";

// Full-screen block shown when this table is already locked by another device.
// Enforces "blokir total": the customer can see the message but cannot browse
// the menu or reach checkout from this device.
export function TableLockGate({ children }: { children: React.ReactNode }) {
  const { locked, lockMessage, loading } = useTable();

  if (!loading && locked) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-bold">Meja Sedang Dipakai</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {lockMessage ||
              "Meja ini sedang dipakai perangkat lain. Silakan pesan dari perangkat tersebut atau minta kasir membebaskan meja."}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
