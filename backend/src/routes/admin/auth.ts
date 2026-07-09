import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { signToken } from "../../lib/auth.js";
import { success, error } from "../../lib/response.js";
import { loginSchema } from "../../lib/validators.js";

const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return error(c, "Username dan password diperlukan", 400);

  const { username, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return error(c, "Username atau password salah", 401);
  }

  const valid = await Bun.password.verify(password, user.passwordHash);
  if (!valid) {
    return error(c, "Username atau password salah", 401);
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = await signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  return success(c, {
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role },
  });
});

export default authRoutes;
