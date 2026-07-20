import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error } from "../../lib/response.js";
import { createUserSchema, updateUserSchema } from "../../lib/validators.js";
import { requireRole, type AuthUser } from "../../lib/auth.js";

const userRoutes = new Hono();
userRoutes.use("*", requireRole("OWNER"));

const userSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

// GET /admin/users
userRoutes.get("/", async (c) => {
  const users = await prisma.adminUser.findMany({
    select: userSelect,
    orderBy: { createdAt: "asc" },
  });
  return success(c, users);
});

// POST /admin/users
userRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return error(c, `Data tidak valid — ${detail}`, 400);
  }

  const { username, password, name, role } = parsed.data;
  const passwordHash = await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });

  try {
    const user = await prisma.adminUser.create({
      data: { username, passwordHash, name, role },
      select: userSelect,
    });
    return success(c, user, 201);
  } catch (err) {
    // Prisma unique-constraint violation on username.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return error(c, "Username sudah dipakai", 400);
    }
    throw err;
  }
});

// PUT /admin/users/:id  (update name/role/isActive, optional password reset)
userRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const me = c.get("user") as AuthUser;
  const body = await c.req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return error(c, `Data tidak valid — ${detail}`, 400);
  }

  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) return error(c, "User tidak ditemukan", 404);

  const data = { ...parsed.data };

  // Cannot deactivate or de-owner yourself (would lock yourself out).
  if (id === me.id) {
    if (data.isActive === false) {
      return error(c, "Tidak bisa menonaktifkan akun sendiri", 400);
    }
    if (data.role && data.role !== "OWNER") {
      return error(c, "Tidak bisa menurunkan role akun sendiri", 400);
    }
  }

  // Keep at least one active owner.
  const demotingOwner = target.role === "OWNER" && data.role && data.role !== "OWNER";
  const deactivatingOwner = target.role === "OWNER" && data.isActive === false;
  if (demotingOwner || deactivatingOwner) {
    const activeOwners = await prisma.adminUser.count({
      where: { role: "OWNER", isActive: true },
    });
    if (activeOwners <= 1) {
      return error(c, "Minimal 1 owner aktif harus tetap ada", 400);
    }
  }

  if (data.password) {
    const passwordHash = await Bun.password.hash(data.password, {
      algorithm: "bcrypt",
      cost: 10,
    });
    (data as { password?: string }).password = undefined;
    (data as { passwordHash?: string }).passwordHash = passwordHash;
  }

  const user = await prisma.adminUser.update({ where: { id }, data, select: userSelect });
  return success(c, user);
});

// DELETE /admin/users/:id
userRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const me = c.get("user") as AuthUser;

  if (id === me.id) return error(c, "Tidak bisa menghapus akun sendiri", 400);

  const target = await prisma.adminUser.findUnique({ where: { id } });
  if (!target) return error(c, "User tidak ditemukan", 404);

  if (target.role === "OWNER") {
    const activeOwners = await prisma.adminUser.count({
      where: { role: "OWNER", isActive: true },
    });
    if (activeOwners <= 1) {
      return error(c, "Minimal 1 owner aktif harus tetap ada", 400);
    }
  }

  await prisma.adminUser.delete({ where: { id } });
  return success(c, { deleted: true });
});

export default userRoutes;
