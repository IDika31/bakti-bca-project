import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error, paginated } from "../../lib/response.js";
import { menuItemSchema } from "../../lib/validators.js";

const menuRoutes = new Hono();

// GET /admin/menu?page=1&limit=20&category=ID
menuRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 20);
  const categoryId = c.req.query("category");

  const where: Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;

  const [items, total] = await Promise.all([
    prisma.menuItem.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.menuItem.count({ where }),
  ]);

  return paginated(c, items, total, page, limit);
});

// POST /admin/menu
menuRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = menuItemSchema.safeParse(body);
  if (!parsed.success) return error(c, "Data tidak valid", 400);

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
  });
  if (!category) return error(c, "Kategori tidak ditemukan", 404);

  const item = await prisma.menuItem.create({ data: parsed.data });
  return success(c, item, 201);
});

// PUT /admin/menu/:id
menuRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = menuItemSchema.safeParse(body);
  if (!parsed.success) return error(c, "Data tidak valid", 400);

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) return error(c, "Menu tidak ditemukan", 404);

  const item = await prisma.menuItem.update({ where: { id }, data: parsed.data });
  return success(c, item);
});

// DELETE /admin/menu/:id
menuRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) return error(c, "Menu tidak ditemukan", 404);

  await prisma.menuItem.delete({ where: { id } });
  return success(c, { deleted: true });
});

// PATCH /admin/menu/:id/availability
menuRoutes.patch("/:id/availability", async (c) => {
  const id = c.req.param("id");
  const { isAvailable } = await c.req.json();

  const item = await prisma.menuItem.update({
    where: { id },
    data: { isAvailable },
  });
  return success(c, item);
});

export default menuRoutes;
