import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import {
  verifyCallbackSignature,
  getTripayConfig,
  checkTransactionStatus,
} from "../lib/tripay.js";
import { AMOUNT_TOLERANCE } from "../lib/constants.js";
import { success, error } from "../lib/response.js";

const tripayRoutes = new Hono();

// POST /tripay/callback — public, signature-validated
tripayRoutes.post("/tripay/callback", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("X-Callback-Signature");

  if (!signature) {
    return c.json({ success: false }, 403);
  }

  let config;
  try {
    config = await getTripayConfig();
  } catch {
    return c.json({ success: false }, 500);
  }

  if (!verifyCallbackSignature(rawBody, signature, config.privateKey)) {
    return c.json({ success: false }, 403);
  }

  const payload = JSON.parse(rawBody);
  const { merchant_ref, reference, status, amount_received } = payload;

  const transaction = await prisma.transaction.findUnique({
    where: { merchantRef: merchant_ref },
    include: { order: true },
  });

  if (!transaction) {
    return c.json({ success: true });
  }

  const paymentStatus = status as string;

  if (paymentStatus === "PAID") {
    const paidAmount = amount_received || transaction.amount;
    const diff = Math.abs(paidAmount - transaction.order.grandTotal);

    let orderPaymentStatus: "PAID" | "UNPAID" = "PAID";
    let orderStatus: "CONFIRMED" | "PENDING" = "CONFIRMED";

    if (diff > AMOUNT_TOLERANCE) {
      // Flag for admin review — still mark as paid but could add a flag
      orderPaymentStatus = "PAID";
      orderStatus = "CONFIRMED";
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: orderPaymentStatus,
          actualPaidAmount: paidAmount,
          paidAt: new Date(),
          callbackPayload: payload,
        },
      }),
      prisma.order.update({
        where: { id: transaction.orderId },
        data: {
          paymentStatus: orderPaymentStatus,
          orderStatus,
        },
      }),
    ]);
  } else if (paymentStatus === "EXPIRED" || paymentStatus === "FAILED") {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: paymentStatus as "EXPIRED" | "FAILED", callbackPayload: payload },
      }),
      prisma.order.update({
        where: { id: transaction.orderId },
        data: { paymentStatus: paymentStatus as "EXPIRED" | "FAILED" },
      }),
    ]);
  } else if (paymentStatus === "REFUND") {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "REFUND", callbackPayload: payload },
      }),
      prisma.order.update({
        where: { id: transaction.orderId },
        data: { paymentStatus: "REFUND" },
      }),
    ]);
  }

  return c.json({ success: true });
});

// GET /tripay/check-status?ref=REFERENCE
tripayRoutes.get("/tripay/check-status", async (c) => {
  const ref = c.req.query("ref");
  if (!ref) return error(c, "Reference diperlukan", 400);

  try {
    const data = await checkTransactionStatus(ref);
    return success(c, { status: data.status });
  } catch (err) {
    return error(c, err instanceof Error ? err.message : "Gagal cek status", 500);
  }
});

export default tripayRoutes;
