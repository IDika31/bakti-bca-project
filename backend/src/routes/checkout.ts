import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { success, error } from "../lib/response.js";
import { checkoutSchema } from "../lib/validators.js";
import { calculatePrice } from "../lib/price.js";
import { generateOrderNumber } from "../lib/order-number.js";
import { createTransaction } from "../lib/tripay.js";

const checkoutRoute = new Hono();

checkoutRoute.post("/checkout", async (c) => {
  const body = await c.req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return error(c, "Data tidak valid: " + JSON.stringify(parsed.error.issues), 400);
  }

  const data = parsed.data;

  // Validate table if dine-in
  let tableId: string | null = null;
  if (data.orderType === "DINE_IN") {
    if (!data.tableToken) return error(c, "Token meja diperlukan untuk dine-in", 400);

    const table = await prisma.table.findUnique({
      where: { token: data.tableToken, isActive: true },
    });
    if (!table) return error(c, "Meja tidak valid", 400);
    tableId = table.id;
  } else {
    if (!data.customerName) return error(c, "Nama pemesan diperlukan untuk take-away", 400);
  }

  // Verify menu items exist and are available
  const menuItemIds = data.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, isAvailable: true },
    select: { id: true, name: true, price: true },
  });

  if (menuItems.length !== menuItemIds.length) {
    return error(c, "Beberapa item tidak tersedia", 400);
  }

  // Calculate subtotal from price snapshots
  const subtotal = data.items.reduce(
    (sum, item) => sum + item.priceSnapshot * item.quantity,
    0
  );

  // Get tax/service config
  const taxConfig = await prisma.taxServiceConfig.findFirst();
  const priceBreakdown = calculatePrice(subtotal, {
    taxEnabled: taxConfig?.taxEnabled ?? false,
    taxPercentage: Number(taxConfig?.taxPercentage ?? 0),
    serviceEnabled: taxConfig?.serviceEnabled ?? false,
    servicePercentage: Number(taxConfig?.servicePercentage ?? 0),
  });

  const orderNumber = await generateOrderNumber();

  // Generate placeholder email if empty
  const appDomain = (process.env.APP_URL || "localhost").replace(/https?:\/\//, "");
  const customerEmail =
    data.customerEmail || `order-${orderNumber}@${appDomain}`;

  // Create order + items in transaction
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        sessionId: data.sessionId,
        orderType: data.orderType,
        tableId,
        customerName: data.customerName || null,
        customerEmail,
        subtotal: priceBreakdown.subtotal,
        serviceAmount: priceBreakdown.serviceAmount,
        taxAmount: priceBreakdown.taxAmount,
        grandTotal: priceBreakdown.grandTotal,
        servicePercent: taxConfig?.serviceEnabled
          ? taxConfig.servicePercentage
          : null,
        taxPercent: taxConfig?.taxEnabled ? taxConfig.taxPercentage : null,
        parentOrderId: data.parentOrderId || null,
        items: {
          create: data.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            priceSnapshot: item.priceSnapshot,
            notes: item.notes || null,
          })),
        },
      },
      include: { items: true },
    });

    return newOrder;
  });

  // Create Tripay transaction
  try {
    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    const tripayResult = await createTransaction({
      method: data.paymentMethodCode,
      merchantRef: orderNumber,
      amount: priceBreakdown.grandTotal,
      customerName: data.customerName || `Meja`,
      customerEmail,
      orderItems: data.items.map((item) => ({
        name: menuItemMap.get(item.menuItemId)?.name || "Item",
        price: item.priceSnapshot,
        quantity: item.quantity,
      })),
      callbackUrl: `${process.env.APP_URL}/api/tripay/callback`,
      returnUrl: `${process.env.FRONTEND_URL}/order/${order.id}`,
    });

    // Save transaction record
    await prisma.transaction.create({
      data: {
        orderId: order.id,
        reference: tripayResult.reference,
        merchantRef: orderNumber,
        paymentMethod: data.paymentMethodCode,
        amount: priceBreakdown.grandTotal,
        payCode: tripayResult.pay_code || null,
        checkoutUrl: tripayResult.checkout_url || null,
        qrUrl: tripayResult.qr_url || null,
        qrString: tripayResult.qr_string || null,
        expiredTime: new Date(tripayResult.expired_time * 1000),
      },
    });

    return success(
      c,
      {
        orderId: order.id,
        orderNumber,
        grandTotal: priceBreakdown.grandTotal,
        transaction: {
          reference: tripayResult.reference,
          payCode: tripayResult.pay_code,
          checkoutUrl: tripayResult.checkout_url,
          qrUrl: tripayResult.qr_url,
          qrString: tripayResult.qr_string,
          expiredTime: new Date(tripayResult.expired_time * 1000).toISOString(),
          instructions: tripayResult.instructions,
        },
      },
      201
    );
  } catch (err) {
    // If Tripay fails, still return order but mark payment as failed
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });

    return error(
      c,
      `Pesanan dibuat tapi pembayaran gagal: ${err instanceof Error ? err.message : "Unknown error"}`,
      500
    );
  }
});

export default checkoutRoute;
