"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminUser, getAdminToken } from "@/lib/auth";
import type { AdminRole } from "@/types";

/**
 * Page-level role guard. Returns `{ allowed, ready }`.
 * - Reads the cached session synchronously (no flash of unauthorized content).
 * - Redirects in an effect if the user lacks one of `roles` or has no session.
 *
 * Defense-in-depth on top of the layout nav filter + backend 403. The backend
 * is the source of truth — this hook only avoids rendering an unauthorized page
 * before the API call rejects it.
 */
export function useRequireRole(...roles: AdminRole[]) {
  const router = useRouter();

  const [ready] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!getAdminToken() && !!getAdminUser();
  });
  const [allowed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const user = getAdminUser();
    return !!user && roles.includes(user.role);
  });

  useEffect(() => {
    if (!ready || !allowed) router.replace("/admin");
  }, [router, ready, allowed]);

  return { ready, allowed };
}
