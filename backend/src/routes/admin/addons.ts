import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error } from "../../lib/response.js";
import { addonSchema } from "../../lib/validators.js";

const addonRoutes = new Hono();

// GET /admin/addons?menuItemId=ID | categoryId=ID | scope=menu|category
addonRoutes.get("/", async (c) => {
  const menuItemId = c.req.query("menuItemId");
  const categoryId = c.req.query("categoryId");

  const where: Record<string, unknown> = {};
  if (menuItemId) where.menuItemId = menuItemId;
  if (categoryId) where.categoryId = categoryId;

  const addons = await prisma.addon.findMany({
    where,
    include: {
      menuItem: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return success(c, addons);
});

// POST /admin/addons
addonRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = addonSchema.safeParse(body);
  if (!parsed.success) return error(c, "Data tidak valid", 400);

  const data = parsed.data;

  // Validate referenced menu item / category exists
  if (data.menuItemId) {
    const menu = await prisma.menuItem.findUnique({ where: { id: data.menuItemId } });
    if (!menu) return error(c, "Menu tidak ditemukan", 404);
  } else if (data.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!cat) return error(c, "Kategori tidak ditemukan", 404);
  }

  const addon = await prisma.addon.create({
    data: {
      name: data.name,
      price: data.price,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      menuItemId: data.menuItemId ?? null,
      categoryId: data.categoryId ?? null,
    },
    include: {
      menuItem: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
  return success(c, addon, 201);
});

// PUT /admin/addons/:id
addonRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = addonSchema.safeParse(body);
  if (!parsed.success) return error(c, "Data tidak valid", 400);

  const existing = await prisma.addon.findUnique({ where: { id } });
  if (!existing) return error(c, "Addon tidak ditemukan", 404);

  const data = parsed.data;

  if (data.menuItemId) {
    const menu = await prisma.menuItem.findUnique({ where: { id: data.menuItemId } });
    if (!menu) return error(c, "Menu tidak ditemukan", 404);
  } else if (data.categoryId) {
    const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
    if (!cat) return error(c, "Kategori tidak ditemukan", 404);
  }

  const addon = await prisma.addon.update({
    where: { id },
    data: {
      name: data.name,
      price: data.price,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      menuItemId: data.menuItemId ?? null,
      categoryId: data.categoryId ?? null,
    },
    include: {
      menuItem: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
    },
  });
  return success(c, addon);
});

// PATCH /admin/addons/:id/availability
addonRoutes.patch("/:id/availability", async (c) => {
  const id = c.req.param("id");
  const { isActive } = await c.req.json();

  const existing = await prisma.addon.findUnique({ where: { id } });
  if (!existing) return error(c, "Addon tidak ditemukan", 404);

  const addon = await prisma.addon.update({
    where: { id },
    data: { isActive },
  });
  return success(c, addon);
});

// DELETE /admin/addons/:id
addonRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.addon.findUnique({ where: { id } });
  if (!existing) return error(c, "Addon tidak ditemukan", 404);

  await prisma.addon.delete({ where: { id } });
  return success(c, { deleted: true });
});

export default addonRoutes;
