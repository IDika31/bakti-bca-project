import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error, paginated } from "../../lib/response.js";
import { orderStatusUpdateSchema } from "../../lib/validators.js";

const orderRoutes = new Hono();

// GET /admin/orders?status=X&date=YYYY-MM-DD&page=1&limit=20&grouped=true
orderRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 50);
  const status = c.req.query("status");
  const paymentStatus = c.req.query("paymentStatus");
  const date = c.req.query("date");
  const since = c.req.query("since");

  const where: Record<string, unknown> = {};
  if (status) where.orderStatus = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (date) {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 1);
    where.createdAt = { gte: start, lt: end };
  }
  if (since) {
    where.createdAt = { gte: new Date(since) };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: {
          include: { menuItem: { select: { name: true, imageUrl: true } } },
        },
        table: { select: { number: true, name: true } },
        transaction: { select: { reference: true, status: true, paymentMethod: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.count({ where }),
  ]);

  return paginated(c, orders, total, page, limit);
});

// GET /admin/orders/:id
orderRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { menuItem: { select: { name: true, imageUrl: true, description: true } } },
      },
      table: { select: { number: true, name: true } },
      transaction: true,
      childOrders: {
        select: { id: true, orderNumber: true, grandTotal: true, orderStatus: true, createdAt: true },
      },
    },
  });

  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  return success(c, order);
});

// PATCH /admin/orders/:id
orderRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = orderStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return error(c, "Status tidak valid", 400);

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return error(c, "Pesanan tidak ditemukan", 404);

  const updated = await prisma.order.update({
    where: { id },
    data: { orderStatus: parsed.data.orderStatus },
  });

  return success(c, updated);
});

// PATCH /admin/orders/:id/pay — mark cashier order as paid
orderRoutes.patch("/:id/pay", async (c) => {
  const id = c.req.param("id");

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  if (order.paymentStatus === "PAID") return error(c, "Pesanan sudah dibayar", 400);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      paymentStatus: "PAID",
      orderStatus: order.orderStatus === "PENDING" ? "CONFIRMED" : order.orderStatus,
    },
  });

  return success(c, updated);
});

// PATCH /admin/orders/:id/complete — mark as completed (+ paid if unpaid)
orderRoutes.patch("/:id/complete", async (c) => {
  const id = c.req.param("id");

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  if (order.orderStatus === "COMPLETED") return error(c, "Pesanan sudah selesai", 400);
  if (order.orderStatus === "CANCELLED") return error(c, "Pesanan sudah dibatalkan", 400);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      orderStatus: "COMPLETED",
      paymentStatus: order.paymentStatus === "UNPAID" ? "PAID" : order.paymentStatus,
    },
  });

  return success(c, updated);
});

export default orderRoutes;
