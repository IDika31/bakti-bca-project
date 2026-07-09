import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { success, error } from "../lib/response.js";

const publicRoutes = new Hono();

// GET /restaurant
publicRoutes.get("/restaurant", async (c) => {
  const profile = await prisma.restaurantProfile.findFirst();
  return success(c, profile);
});

// GET /categories
publicRoutes.get("/categories", async (c) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return success(c, categories);
});

// GET /menu?category=ID&search=TERM
publicRoutes.get("/menu", async (c) => {
  const categoryId = c.req.query("category");
  const search = c.req.query("search");

  const where: Record<string, unknown> = { isAvailable: true };
  if (categoryId) where.categoryId = categoryId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const items = await prisma.menuItem.findMany({
    where,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return success(c, items);
});

// GET /tax-config
publicRoutes.get("/tax-config", async (c) => {
  const config = await prisma.taxServiceConfig.findFirst();
  return success(c, config);
});

// GET /tables/validate?t=TOKEN
publicRoutes.get("/tables/validate", async (c) => {
  const token = c.req.query("t");
  if (!token) return error(c, "Token tidak diberikan", 400);

  const table = await prisma.table.findUnique({
    where: { token, isActive: true },
    select: { id: true, number: true, name: true },
  });

  if (!table) return error(c, "Meja tidak ditemukan", 404);
  return success(c, table);
});

// GET /payment-methods (active + shown only)
publicRoutes.get("/payment-methods", async (c) => {
  const methods = await prisma.paymentMethod.findMany({
    where: { isActive: true, isShown: true },
    select: {
      id: true,
      code: true,
      name: true,
      groupName: true,
      type: true,
      feeCustomer: true,
      minAmount: true,
      maxAmount: true,
      iconUrl: true,
    },
    orderBy: { groupName: "asc" },
  });
  return success(c, methods);
});

// GET /orders/:id (customer polling)
publicRoutes.get("/orders/:id", async (c) => {
  const id = c.req.param("id");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          menuItem: { select: { name: true, imageUrl: true } },
        },
      },
      table: { select: { number: true, name: true } },
      transaction: {
        select: {
          reference: true,
          payCode: true,
          checkoutUrl: true,
          qrUrl: true,
          qrString: true,
          status: true,
          expiredTime: true,
        },
      },
    },
  });

  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  return success(c, order);
});

// GET /operating-hours
publicRoutes.get("/operating-hours", async (c) => {
  const hours = await prisma.operatingHours.findMany({
    orderBy: { dayOfWeek: "asc" },
  });
  return success(c, hours);
});

export default publicRoutes;
