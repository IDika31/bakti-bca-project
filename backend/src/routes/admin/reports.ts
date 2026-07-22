import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error } from "../../lib/response.js";
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval } from "date-fns";
import { requireRole } from "../../lib/auth.js";

const reportRoutes = new Hono();
reportRoutes.use("*", requireRole("OWNER", "ADMIN"));

// GET /admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month
reportRoutes.get("/", async (c) => {
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  const to = toParam ? endOfDay(new Date(toParam)) : endOfDay(new Date());
  const from = fromParam ? startOfDay(new Date(fromParam)) : startOfDay(subDays(to, 30));

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "PAID",
      createdAt: { gte: from, lte: to },
    },
    select: {
      grandTotal: true,
      subtotal: true,
      serviceAmount: true,
      taxAmount: true,
      createdAt: true,
      orderType: true,
      transaction: { select: { paymentMethod: true } },
    },
  });

  // Group by day
  const dailyMap = new Map<string, { revenue: number; orders: number; service: number; tax: number }>();
  const methodMap = new Map<string, { count: number; total: number }>();

  for (const order of orders) {
    const day = format(order.createdAt, "yyyy-MM-dd");
    const existing = dailyMap.get(day) || { revenue: 0, orders: 0, service: 0, tax: 0 };
    existing.revenue += order.grandTotal;
    existing.orders += 1;
    existing.service += order.serviceAmount;
    existing.tax += order.taxAmount;
    dailyMap.set(day, existing);

    const method = order.transaction?.paymentMethod || "Bayar di Kasir";
    const methodExisting = methodMap.get(method) || { count: 0, total: 0 };
    methodExisting.count += 1;
    methodExisting.total += order.grandTotal;
    methodMap.set(method, methodExisting);
  }

  // Fill in every day in the range with zero-valued data if it has no paid
  // orders. Without this, days with no orders are simply absent from the
  // array (not zero) — if only one day in the range has data, the frontend
  // line chart receives a single point and can't draw a connecting line,
  // it just renders a lone dot.
  const daily = eachDayOfInterval({ start: from, end: to }).map((d) => {
    const date = format(d, "yyyy-MM-dd");
    const data = dailyMap.get(date) || { revenue: 0, orders: 0, service: 0, tax: 0 };
    return { date, ...data };
  });

  const byMethod = Array.from(methodMap.entries())
    .map(([method, data]) => ({ method, ...data }))
    .sort((a, b) => b.total - a.total);

  const totalRevenue = orders.reduce((sum, o) => sum + o.grandTotal, 0);
  const totalService = orders.reduce((sum, o) => sum + o.serviceAmount, 0);
  const totalTax = orders.reduce((sum, o) => sum + o.taxAmount, 0);
  const dineInCount = orders.filter((o) => o.orderType === "DINE_IN").length;
  const takeAwayCount = orders.filter((o) => o.orderType === "TAKE_AWAY").length;

  return success(c, {
    period: { from: from.toISOString(), to: to.toISOString() },
    summary: {
      totalRevenue,
      totalOrders: orders.length,
      totalService,
      totalTax,
      dineInCount,
      takeAwayCount,
      averageOrder: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
    },
    daily,
    byMethod,
  });
});

// GET /admin/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD
reportRoutes.get("/export", async (c) => {
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  const to = toParam ? endOfDay(new Date(toParam)) : endOfDay(new Date());
  const from = fromParam ? startOfDay(new Date(fromParam)) : startOfDay(subDays(to, 30));

  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "PAID",
      createdAt: { gte: from, lte: to },
    },
    include: {
      items: { include: { menuItem: { select: { name: true } } } },
      table: { select: { number: true } },
      transaction: { select: { paymentMethod: true, reference: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = [
    ["No Pesanan", "Tanggal", "Tipe", "Meja", "Nama", "Subtotal", "Service", "Pajak", "Total", "Metode", "Referensi"].join(","),
    ...orders.map((o) =>
      [
        o.orderNumber,
        format(o.createdAt, "yyyy-MM-dd HH:mm"),
        o.orderType,
        o.table?.number || "-",
        o.customerName || "-",
        o.subtotal,
        o.serviceAmount,
        o.taxAmount,
        o.grandTotal,
        o.transaction?.paymentMethod || "-",
        o.transaction?.reference || "-",
      ].join(",")
    ),
  ].join("\n");

  return new Response(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laporan-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}.csv"`,
    },
  });
});

export default reportRoutes;