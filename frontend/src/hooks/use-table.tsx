"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { TableInfo, ApiResponse } from "@/types";

interface TableContextType {
  table: TableInfo | null;
  loading: boolean;
  isDineIn: boolean;
}

const TableContext = createContext<TableContextType>({ table: null, loading: true, isDineIn: false });

export function TableProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const token = searchParams.get("t") || null;
  const [table, setTable] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(!!token);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

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
      .get<ApiResponse<TableInfo>>(`/api/tables/validate?t=${token}`)
      .then((res) => {
        setTable(res.data);
        sessionStorage.setItem("table-info", JSON.stringify({ token, table: res.data }));
      })
      .catch(() => setTable(null))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <TableContext.Provider value={{ table, loading, isDineIn: !!table }}>
      {children}
    </TableContext.Provider>
  );
}

export function useTable() {
  return useContext(TableContext);
}
