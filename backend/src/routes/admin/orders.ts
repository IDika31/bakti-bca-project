import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error, paginated } from "../../lib/response.js";
import { orderStatusUpdateSchema, cashierPaySchema } from "../../lib/validators.js";
import { requireRole } from "../../lib/auth.js";
import { releaseLockForOrder } from "../../lib/table-lock.js";

const orderRoutes = new Hono();
// All admin roles may read/update orders (cashier marks orders paid + completes them).
orderRoutes.use("*", requireRole("OWNER", "ADMIN", "CASHIER"));

// GET /admin/orders?status=X&date=YYYY-MM-DD&page=1&limit=20&grouped=true
orderRoutes.get("/", async (c) => {
  const page = Number(c.req.query("page") || 1);
  const limit = Number(c.req.query("limit") || 50);
  const status = c.req.query("status");
  const paymentStatus = c.req.query("paymentStatus");
  const date = c.req.query("date");
  const since = c.req.query("since");
  const search = c.req.query("search");

  const where: Record<string, unknown> = {};
  if (status) where.orderStatus = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
    ];
  }
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
        select: {
          id: true,
          quantity: true,
          notes: true,
          priceSnapshot: true,
          menuItem: { select: { name: true, imageUrl: true, description: true } },
          addons: {
            select: { id: true, name: true, priceSnapshot: true, quantity: true },
          },
        },
      },
      table: { select: { number: true, name: true } },
      transaction: true,
      childOrders: {
        select: { id: true, orderNumber: true, grandTotal: true, orderStatus: true, createdAt: true },
      },
    },
  });

  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  // Schema guarantees priceSnapshot Int non-null; remap to `price` for client.
  const items = order.items.map((it) => ({
    id: it.id,
    quantity: it.quantity,
    notes: it.notes,
    price: it.priceSnapshot,
    menuItem: it.menuItem,
    addons: it.addons,
  }));
  return success(c, { ...order, items });
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

  // Terminal status frees the table's device lock.
  if (parsed.data.orderStatus === "COMPLETED" || parsed.data.orderStatus === "CANCELLED") {
    await releaseLockForOrder(id);
  }

  return success(c, updated);
});

// PATCH /admin/orders/:id/pay — mark cashier order as paid (CASH or QRIS).
// Records a Transaction row so reports can split revenue by settlement method.
// Orders already paid via Tripay callback have their transaction created at
// checkout; we only create one here for manual cashier settlement.
orderRoutes.patch("/:id/pay", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = cashierPaySchema.safeParse(body);
  if (!parsed.success) {
    return error(c, "Metode pembayaran wajib diisi (CASH atau QRIS)", 400);
  }
  const method = parsed.data.method;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  if (order.paymentStatus === "PAID") return error(c, "Pesanan sudah dibayar", 400);

  const now = new Date();

  // Upsert a PAID transaction tagged with the settlement method. Use upsert
  // so a re-call after a partial failure doesn't duplicate; orderId is unique.
  await prisma.transaction.upsert({
    where: { orderId: id },
    update: { paymentMethod: method, status: "PAID", paidAt: now },
    create: {
      orderId: id,
      merchantRef: order.orderNumber,
      paymentMethod: method,
      amount: order.grandTotal,
      status: "PAID",
      paidAt: now,
      expiredTime: now,
    },
  });

  const updated = await prisma.order.update({
    where: { id },
    data: {
      paymentStatus: "PAID",
      // Payment no longer drives order status; the flow is
      // PLACED → PREPARING → READY → PICKED_UP → COMPLETED and payment is
      // settled at the counter (paymentStatus) independent of that progression.
    },
    include: { transaction: true },
  });

  return success(c, updated);
});

// PATCH /admin/orders/:id/cancel — cancel with reason
orderRoutes.patch("/:id/cancel", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length < 3) {
    return error(c, "Alasan pembatalan wajib diisi (min 3 karakter)", 400);
  }
  if (reason.length > 500) {
    return error(c, "Alasan pembatalan maks 500 karakter", 400);
  }

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  if (order.orderStatus === "CANCELLED") return error(c, "Pesanan sudah dibatalkan", 400);
  if (order.orderStatus === "COMPLETED") return error(c, "Pesanan sudah selesai, tidak bisa dibatalkan", 400);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      orderStatus: "CANCELLED",
      cancellationReason: reason,
      cancelledAt: new Date(),
    },
  });

  await releaseLockForOrder(id);

  return success(c, updated);
});

// PATCH /admin/orders/:id/complete — mark as completed. Requires payment first:
// in the new flow the order is settled (paymentStatus PAID) before it can be
// completed, so this refuses to complete an unpaid order.
orderRoutes.patch("/:id/complete", async (c) => {
  const id = c.req.param("id");

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return error(c, "Pesanan tidak ditemukan", 404);
  if (order.orderStatus === "COMPLETED") return error(c, "Pesanan sudah selesai", 400);
  if (order.orderStatus === "CANCELLED") return error(c, "Pesanan sudah dibatalkan", 400);
  if (order.paymentStatus !== "PAID") {
    return error(c, "Pesanan belum dibayar — tandai lunas dulu sebelum menyelesaikan", 400);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { orderStatus: "COMPLETED" },
  });

  await releaseLockForOrder(id);

  return success(c, updated);
});

export default orderRoutes;
