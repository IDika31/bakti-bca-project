import type { Context, Next } from "hono";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma.js";

export type Role = "OWNER" | "ADMIN" | "CASHIER";

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  isActive: boolean;
}

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

export async function signToken(payload: {
  userId: string;
  username: string;
  role: Role;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(process.env.JWT_EXPIRES_IN || "24h")
    .setIssuedAt()
    .sign(secret);
}

export async function verifyToken(
  token: string
): Promise<{ userId: string; username: string; role: Role } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; username: string; role: Role };
  } catch {
    return null;
  }
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ success: false, error: "Token invalid atau kedaluwarsa" }, 401);
  }

  const user = await prisma.adminUser.findUnique({
    where: { id: payload.userId },
    select: { id: true, username: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return c.json({ success: false, error: "User tidak ditemukan atau nonaktif" }, 401);
  }

  c.set("user", user as AuthUser);
  await next();
}

/**
 * Role guard middleware. Place AFTER authMiddleware (which sets c.get("user")).
 * Returns 403 if the authenticated user's role is not in the allowed set.
 */
export function requireRole(...allowed: Role[]) {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as AuthUser | undefined;
    if (!user || !allowed.includes(user.role)) {
      return c.json({ success: false, error: "Forbidden: role tidak diizinkan" }, 403);
    }
    await next();
  };
}
