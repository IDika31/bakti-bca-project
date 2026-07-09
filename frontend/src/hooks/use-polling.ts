"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  options?: { enabled?: boolean; stopWhen?: (data: T) => boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const stopped = useRef(false);

  const poll = useCallback(async () => {
    if (stopped.current) return;
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
      if (options?.stopWhen?.(result)) {
        stopped.current = true;
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [fetcher, options?.stopWhen]);

  useEffect(() => {
    if (options?.enabled === false) return;
    stopped.current = false;

    poll();
    const interval = setInterval(() => {
      if (!stopped.current) poll();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [poll, intervalMs, options?.enabled]);

  return { data, error, loading };
}
