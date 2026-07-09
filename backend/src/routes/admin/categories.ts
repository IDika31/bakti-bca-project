import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error } from "../../lib/response.js";
import { categorySchema } from "../../lib/validators.js";

const categoryRoutes = new Hono();

categoryRoutes.get("/", async (c) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { menuItems: true } } },
  });
  return success(c, categories);
});

categoryRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return error(c, "Data tidak valid", 400);

  const category = await prisma.category.create({ data: parsed.data });
  return success(c, category, 201);
});

categoryRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) return error(c, "Data tidak valid", 400);

  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return error(c, "Kategori tidak ditemukan", 404);

  const category = await prisma.category.update({ where: { id }, data: parsed.data });
  return success(c, category);
});

categoryRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const menuCount = await prisma.menuItem.count({ where: { categoryId: id } });
  if (menuCount > 0) {
    return error(c, `Kategori masih memiliki ${menuCount} menu, tidak bisa dihapus`, 400);
  }

  await prisma.category.delete({ where: { id } });
  return success(c, { deleted: true });
});

export default categoryRoutes;
