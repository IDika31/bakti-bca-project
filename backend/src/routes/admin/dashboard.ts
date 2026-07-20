import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success } from "../../lib/response.js";
import { requireRole } from "../../lib/auth.js";

const dashboardRoutes = new Hono();
dashboardRoutes.use("*", requireRole("OWNER", "ADMIN", "CASHIER"));

dashboardRoutes.get("/", async (c) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    todayOrders,
    todayRevenue,
    pendingOrders,
    totalMenuItems,
    activeTables,
  ] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: "PAID" },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: today, lt: tomorrow }, paymentStatus: "PAID" },
      _sum: { grandTotal: true },
    }),
    prisma.order.count({
      where: {
        orderStatus: { in: ["CONFIRMED", "PREPARING"] },
        paymentStatus: "PAID",
      },
    }),
    prisma.menuItem.count({ where: { isAvailable: true } }),
    prisma.table.count({ where: { isActive: true } }),
  ]);

  const recentOrders = await prisma.order.findMany({
    where: { paymentStatus: "PAID" },
    include: {
      table: { select: { number: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return success(c, {
    todayOrders,
    todayRevenue: todayRevenue._sum.grandTotal || 0,
    pendingOrders,
    totalMenuItems,
    activeTables,
    recentOrders,
  });
});

export default dashboardRoutes;
