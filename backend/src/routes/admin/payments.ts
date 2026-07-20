import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error } from "../../lib/response.js";
import { syncPaymentChannels } from "../../lib/tripay.js";
import { requireRole } from "../../lib/auth.js";

const paymentRoutes = new Hono();

// Cashier endpoints (manual cash payment) — kasir, admin, owner all allowed.
const cashGuard = requireRole("OWNER", "ADMIN", "CASHIER");
// Payment management + Tripay sync — admin + owner only (kasir cannot see all methods).
const mgrGuard = requireRole("OWNER", "ADMIN");

paymentRoutes.get("/", mgrGuard, async (c) => {
  const methods = await prisma.paymentMethod.findMany({
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
  });
  return success(c, methods);
});

paymentRoutes.get("/cashier", cashGuard, async (c) => {
  const method = await prisma.paymentMethod.findUnique({
    where: { code: "CASHIER" },
  });
  return success(c, method);
});

paymentRoutes.put("/cashier", cashGuard, async (c) => {
  const { isShown } = await c.req.json();
  const method = await prisma.paymentMethod.upsert({
    where: { code: "CASHIER" },
    update: { isShown: !!isShown, isActive: true },
    create: {
      code: "CASHIER",
      name: "Bayar di Kasir",
      groupName: "CASHIER",
      type: "direct",
      isActive: true,
      isShown: !!isShown,
    },
  });
  return success(c, method);
});

paymentRoutes.post("/sync", mgrGuard, async (c) => {
  try {
    const count = await syncPaymentChannels();
    return success(c, { synced: count });
  } catch (err) {
    return error(c, err instanceof Error ? err.message : "Gagal sinkronisasi", 500);
  }
});

paymentRoutes.patch("/:id", mgrGuard, async (c) => {
  const id = c.req.param("id");
  const { isShown } = await c.req.json();

  const method = await prisma.paymentMethod.update({
    where: { id },
    data: { isShown },
  });
  return success(c, method);
});

export default paymentRoutes;
