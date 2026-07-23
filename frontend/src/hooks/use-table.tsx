"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type { TableInfo, ApiResponse } from "@/types";

export type OrderType = "DINE_IN" | "TAKE_AWAY";

interface TableContextType {
  table: TableInfo | null;
  loading: boolean;
  isDineIn: boolean;
  // true when this table is locked by another device — this device may browse
  // the menu read-only but cannot order.
  locked: boolean;
  lockMessage: string | null;
  // Explicit choice for walk-in customers (no table QR). null = belum dipilih,
  // gate akan tampilkan chooser. Kalau ada meja, otomatis DINE_IN.
  orderType: OrderType | null;
  setOrderType: (t: OrderType) => void;
}

const TableContext = createContext<TableContextType>({
  table: null,
  loading: true,
  isDineIn: false,
  locked: false,
  lockMessage: null,
  orderType: null,
  setOrderType: () => {},
});

const ORDER_TYPE_KEY = "order-type";

// Per-device identity used for the table lock. Created once and reused for the
// eventual checkout, so the device that claimed the lock is the one that orders.
function getSessionId(): string {
  let id = sessionStorage.getItem("session-id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("session-id", id);
  }
  return id;
}

export function TableProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || null;
  const [table, setTable] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [locked, setLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [orderType, setOrderTypeState] = useState<OrderType | null>(null);

  // Hydrate stored choice once on mount (walk-in customers).
  useEffect(() => {
    const stored = sessionStorage.getItem(ORDER_TYPE_KEY);
    if (stored === "DINE_IN" || stored === "TAKE_AWAY") {
      setOrderTypeState(stored);
    }
  }, []);

  const setOrderType = (t: OrderType) => {
    sessionStorage.setItem(ORDER_TYPE_KEY, t);
    setOrderTypeState(t);
  };

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const sessionId = getSessionId();

    // Cached table-info means we already validated + claimed the lock this
    // session; trust it (the lock is ours) and skip a re-claim.
    const stored = sessionStorage.getItem("table-info");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token === token) {
          setTable(parsed.table);
          setLoading(false);
          return;
        }
      } catch { /* ignore */ }
    }

    api
      .get<ApiResponse<TableInfo>>(`/api/tables/validate?t=${token}&sessionId=${sessionId}`)
      .then((res) => {
        setTable(res.data);
        setLocked(false);
        setLockMessage(null);
        sessionStorage.setItem("table-info", JSON.stringify({ token, table: res.data }));
      })
      .catch((err) => {
        // 423 Locked → another device holds this table. Keep isDineIn semantics
        // off (no table) so checkout is blocked, and surface the reason.
        if (err instanceof ApiError && err.status === 423) {
          setLocked(true);
          setLockMessage(err.message);
        }
        setTable(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Efektif: kalau ada meja QR, default ke DINE_IN tapi customer bisa
  // switch ke TAKE_AWAY (pesan bungkus dari meja). Tanpa meja, pakai pilihan explicit.
  const effectiveOrderType: OrderType | null = table
    ? (orderType ?? "DINE_IN")
    : orderType;

  return (
    <TableContext.Provider
      value={{
        table,
        loading,
        isDineIn: effectiveOrderType === "DINE_IN",
        locked,
        lockMessage,
        orderType: effectiveOrderType,
        setOrderType,
      }}
    >
      {children}
    </TableContext.Provider>
  );
}

export function useTable() {
  return useContext(TableContext);
}
