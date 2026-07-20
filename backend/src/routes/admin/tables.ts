import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error } from "../../lib/response.js";
import { tableSchema } from "../../lib/validators.js";
import QRCode from "qrcode";
import { requireRole } from "../../lib/auth.js";

const tableRoutes = new Hono();
tableRoutes.use("*", requireRole("OWNER", "ADMIN"));

tableRoutes.get("/", async (c) => {
  const tables = await prisma.table.findMany({
    orderBy: { number: "asc" },
    include: { _count: { select: { orders: true } } },
  });
  return success(c, tables);
});

tableRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = tableSchema.safeParse(body);
  if (!parsed.success) return error(c, "Data tidak valid", 400);

  const existing = await prisma.table.findUnique({ where: { number: parsed.data.number } });
  if (existing) return error(c, `Meja nomor ${parsed.data.number} sudah ada`, 400);

  const table = await prisma.table.create({
    data: {
      number: parsed.data.number,
      name: parsed.data.name || `Meja ${parsed.data.number}`,
    },
  });
  return success(c, table, 201);
});

tableRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = tableSchema.safeParse(body);
  if (!parsed.success) return error(c, "Data tidak valid", 400);

  const table = await prisma.table.update({
    where: { id },
    data: { number: parsed.data.number, name: parsed.data.name },
  });
  return success(c, table);
});

tableRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  if (typeof body.isActive !== "boolean") {
    return error(c, "isActive harus boolean", 400);
  }
  const table = await prisma.table.update({
    where: { id },
    data: { isActive: body.isActive },
  });
  return success(c, table);
});

tableRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await prisma.table.delete({ where: { id } });
  return success(c, { deleted: true });
});

// POST /admin/tables/:id/regenerate
tableRoutes.post("/:id/regenerate", async (c) => {
  const id = c.req.param("id");

  const table = await prisma.table.update({
    where: { id },
    data: {
      token: crypto.randomUUID(),
      tokenRegeneratedAt: new Date(),
    },
  });

  return success(c, table);
});

// GET /admin/tables/:id/qr
tableRoutes.get("/:id/qr", async (c) => {
  const id = c.req.param("id");
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) return error(c, "Meja tidak ditemukan", 404);

  const frontendUrl = process.env.FRONTEND_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || "http://localhost:3000";
  const url = `${frontendUrl}/?t=${table.token}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });

  return success(c, { url, qrDataUrl, tableNumber: table.number, tableName: table.name });
});

export default tableRoutes;
