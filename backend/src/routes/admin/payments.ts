import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error } from "../../lib/response.js";
import { syncPaymentChannels } from "../../lib/tripay.js";

const paymentRoutes = new Hono();

paymentRoutes.get("/", async (c) => {
  const methods = await prisma.paymentMethod.findMany({
    orderBy: [{ groupName: "asc" }, { name: "asc" }],
  });
  return success(c, methods);
});

paymentRoutes.post("/sync", async (c) => {
  try {
    const count = await syncPaymentChannels();
    return success(c, { synced: count });
  } catch (err) {
    return error(c, err instanceof Error ? err.message : "Gagal sinkronisasi", 500);
  }
});

paymentRoutes.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const { isShown } = await c.req.json();

  const method = await prisma.paymentMethod.update({
    where: { id },
    data: { isShown },
  });
  return success(c, method);
});

export default paymentRoutes;
