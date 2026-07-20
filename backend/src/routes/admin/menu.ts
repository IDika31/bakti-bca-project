import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error, paginated } from "../../lib/response.js";
import { menuItemSchema } from "../../lib/validators.js";
import { deleteImageIfUnused } from "../../lib/storage-cleanup.js";
import { requireRole } from "../../lib/auth.js";

const menuRoutes = new Hono();
menuRoutes.use("*", requireRole("OWNER", "ADMIN"));

// GET /admin/menu?page=1&limit=50&category=ID&search=TERM
menuRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 50);
  const categoryId = c.req.query("category");
  const search = c.req.query("search");

  const where: Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

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

  // Empty string = "no image". Normalize to null so we store NULL, matching
  // the PUT path and avoiding a broken <img src=""> on the client.
  const data = { ...parsed.data };
  if (data.imageUrl === "") data.imageUrl = null;

  const item = await prisma.menuItem.create({ data });
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

  // Empty string = "clear the image". Normalize to null so Prisma stores NULL
  // rather than an empty string. undefined = leave the field untouched.
  const data = { ...parsed.data };
  if (data.imageUrl === "") data.imageUrl = null;
  const newImageUrl = data.imageUrl === undefined ? existing.imageUrl : data.imageUrl;

  const item = await prisma.menuItem.update({ where: { id }, data });

  // If the image changed (cleared or swapped), attempt to delete the old file
  // from storage — but only if nothing else references it (content-addressed
  // uploads may be shared). Best-effort, never fails the request.
  if (existing.imageUrl && existing.imageUrl !== newImageUrl) {
    await deleteImageIfUnused(existing.imageUrl);
  }

  return success(c, item);
});

// DELETE /admin/menu/:id
menuRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) return error(c, "Menu tidak ditemukan", 404);

  await prisma.menuItem.delete({ where: { id } });

  // The menu is gone, so its image is unreferenced — delete the file.
  // deleteImageIfUnused still double-checks references for safety.
  await deleteImageIfUnused(existing.imageUrl);

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
