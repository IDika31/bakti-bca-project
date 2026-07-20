import type { AdminRole, AdminUser } from "@/types";

const TOKEN_KEY = "admin-token";
const USER_KEY = "admin-user";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getAdminUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function setAdminSession(token: string, user: AdminUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAdminSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasRole(...roles: AdminRole[]): boolean {
  const u = getAdminUser();
  return !!u && roles.includes(u.role);
}
