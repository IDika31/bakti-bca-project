import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { success, error } from "../lib/response.js";
import { getPaymentInstructions } from "../lib/tripay.js";
import { canClaimLock } from "../lib/table-lock.js";

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
    include: {
      category: {
        select: {
          id: true,
          name: true,
          addons: {
            where: { isActive: true },
            select: { id: true, name: true, price: true, sortOrder: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
        },
      },
      addons: {
        where: { isActive: true },
        select: { id: true, name: true, price: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  return success(c, items);
});

// GET /tax-config
publicRoutes.get("/tax-config", async (c) => {
  const config = await prisma.taxServiceConfig.findFirst();
  return success(c, config);
});

// GET /tables/validate?t=TOKEN&sessionId=UUID
// Validates the table AND claims a per-device lock: only one device (session)
// may order from a table at a time. A second device scanning the same QR is
// rejected with 423 while the first device's order is still in progress.
publicRoutes.get("/tables/validate", async (c) => {
  const token = c.req.query("t");
  if (!token) return error(c, "Token tidak diberikan", 400);
  const sessionId = c.req.query("sessionId");

  const table = await prisma.table.findUnique({
    where: { token, isActive: true },
    select: { id: true, number: true, name: true, lockedSessionId: true, lockedAt: true },
  });

  if (!table) return error(c, "Meja tidak ditemukan", 404);

  // No sessionId → legacy/soft check, just return table info without locking.
  if (!sessionId) {
    return success(c, { id: table.id, number: table.number, name: table.name });
  }

  // Check if table lock feature is enabled.
  const profile = await prisma.restaurantProfile.findFirst({
    select: { tableLockEnabled: true },
  });
  const lockEnabled = profile?.tableLockEnabled ?? false;

  if (lockEnabled) {
    const allowed = await canClaimLock(table, sessionId);
    if (!allowed) {
      return error(
        c,
        "Meja ini sedang dipakai perangkat lain. Silakan pesan dari perangkat tersebut atau minta kasir membebaskan meja.",
        423
      );
    }

    // Claim (or refresh) the lock for this device.
    const claimWhere: Record<string, unknown> = { id: table.id };
    if (table.lockedSessionId) {
      claimWhere.lockedSessionId = table.lockedSessionId;
    } else {
      claimWhere.lockedSessionId = null;
    }
    await prisma.table.updateMany({
      where: claimWhere,
      data: { lockedSessionId: sessionId, lockedAt: new Date() },
    });
  }

  return success(c, { id: table.id, number: table.number, name: table.name });
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
          addons: true,
        },
      },
      table: { select: { number: true, name: true } },
      transaction: {
        select: {
          reference: true,
          paymentMethod: true,
          payCode: true,
          checkoutUrl: true,
          qrUrl: true,
          qrString: true,
          status: true,
          expiredTime: true,
          amount: true,
        },
      },
    },
  });

  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  return success(c, order);
});

// GET /payment-instructions?code=BRIVA&pay_code=XXX&amount=10000
publicRoutes.get("/payment-instructions", async (c) => {
  const code = c.req.query("code");
  if (!code) return error(c, "Parameter code diperlukan", 400);
  const payCode = c.req.query("pay_code");
  const amount = c.req.query("amount");

  try {
    const instructions = await getPaymentInstructions(
      code,
      payCode,
      amount ? Number(amount) : undefined
    );
    return success(c, instructions);
  } catch (err) {
    return error(c, err instanceof Error ? err.message : "Gagal ambil instruksi", 500);
  }
});

// GET /operating-hours
publicRoutes.get("/operating-hours", async (c) => {
  const hours = await prisma.operatingHours.findMany({
    orderBy: { dayOfWeek: "asc" },
  });
  return success(c, hours);
});

export default publicRoutes;
