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

  // Guard: restaurant must be open
  const now = new Date();
  const todayHours = await prisma.operatingHours.findUnique({
    where: { dayOfWeek: now.getDay() },
  });
  if (todayHours && !todayHours.isClosed) {
    const [oh, om] = todayHours.openTime.split(":").map(Number);
    const [ch, cm] = todayHours.closeTime.split(":").map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const openMin = (oh ?? 0) * 60 + (om ?? 0);
    const closeMin = (ch ?? 0) * 60 + (cm ?? 0);
    const overnight = closeMin <= openMin;
    const isOpen = overnight
      ? nowMin >= openMin || nowMin < closeMin
      : nowMin >= openMin && nowMin < closeMin;
    if (!isOpen) {
      return error(c, "Restoran sedang tutup. Pemesanan tidak bisa diproses.", 400);
    }
  } else if (todayHours?.isClosed) {
    return error(c, "Restoran tutup hari ini.", 400);
  }

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
    select: { id: true, name: true, price: true, categoryId: true },
  });

  if (menuItems.length !== menuItemIds.length) {
    return error(c, "Beberapa item tidak tersedia", 400);
  }

  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  // Validate addons + fetch snapshots. An addon is valid for an item if it is
  // either scoped to that menu item or scoped to the item's category, and active.
  const allAddonIds = new Set<string>();
  for (const item of data.items) {
    for (const a of item.addons ?? []) allAddonIds.add(a.addonId);
  }

  let addonSnapshots = new Map<
    string,
    { id: string; name: string; price: number; menuItemId: string | null; categoryId: string | null }
  >();
  if (allAddonIds.size > 0) {
    const addons = await prisma.addon.findMany({
      where: { id: { in: [...allAddonIds] }, isActive: true },
      select: { id: true, name: true, price: true, menuItemId: true, categoryId: true },
    });
    addonSnapshots = new Map(addons.map((a) => [a.id, a]));

    // Validate each item's addons belong to it (menu-scoped) or its category (category-scoped)
    for (const item of data.items) {
      const menu = menuItemMap.get(item.menuItemId);
      if (!menu) continue;
      for (const a of item.addons ?? []) {
        const snap = addonSnapshots.get(a.addonId);
        if (!snap) {
          return error(c, `Addon tidak valid atau tidak aktif`, 400);
        }
        const belongsToMenu = snap.menuItemId === item.menuItemId;
        const belongsToCategory = snap.categoryId === menu.categoryId;
        if (!belongsToMenu && !belongsToCategory) {
          return error(c, `Addon "${snap.name}" tidak berlaku untuk item ini`, 400);
        }
      }
    }
  }

  // Calculate subtotal from price snapshots (base price + addons) * quantity
  const subtotal = data.items.reduce((sum, item) => {
    const addonTotal = (item.addons ?? []).reduce((s, a) => {
      const snap = addonSnapshots.get(a.addonId);
      const addonPrice = snap?.price ?? 0;
      const qty = a.quantity ?? 1;
      return s + addonPrice * qty;
    }, 0);
    return sum + (item.priceSnapshot + addonTotal) * item.quantity;
  }, 0);

  // Get tax/service config
  const taxConfig = await prisma.taxServiceConfig.findFirst();
  const priceBreakdown = calculatePrice(subtotal, {
    taxEnabled: taxConfig?.taxEnabled ?? false,
    taxPercentage: Number(taxConfig?.taxPercentage ?? 0),
    serviceEnabled: taxConfig?.serviceEnabled ?? false,
    servicePercentage: Number(taxConfig?.servicePercentage ?? 0),
  });

  const orderNumber = await generateOrderNumber();

  const baseUrl = process.env.APP_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3001");

  // Generate placeholder email if empty.
  // Use a neutral default domain (env-configurable) so customer emails never
  // leak the deployment host / project brand.
  const emailDomain = process.env.DEFAULT_EMAIL_DOMAIN || "noreply.local";
  const customerEmail =
    data.customerEmail || `order-${orderNumber}@${emailDomain}`;

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
            addons: {
              create: (item.addons ?? []).map((a) => {
                const snap = addonSnapshots.get(a.addonId);
                return {
                  addonId: a.addonId,
                  name: snap?.name ?? "Addon",
                  priceSnapshot: snap?.price ?? 0,
                  quantity: a.quantity ?? 1,
                };
              }),
            },
          })),
        },
      },
      include: { items: true },
    });

    return newOrder;
  });

  // Cashier payment — skip Tripay entirely
  if (data.paymentMethodCode === "CASHIER") {
    return success(
      c,
      {
        orderId: order.id,
        orderNumber,
        grandTotal: priceBreakdown.grandTotal,
        transaction: { reference: orderNumber },
      },
      201
    );
  }

  // Create Tripay transaction
  try {
    const tripayResult = await createTransaction({
      method: data.paymentMethodCode,
      merchantRef: orderNumber,
      amount: priceBreakdown.grandTotal,
      customerName: data.customerName || `Meja`,
      customerEmail,
      orderItems: data.items.map((item) => {
        const addonTotal = (item.addons ?? []).reduce((s, a) => {
          const snap = addonSnapshots.get(a.addonId);
          return s + (snap?.price ?? 0) * (a.quantity ?? 1);
        }, 0);
        const addonNames = (item.addons ?? [])
          .map((a) => addonSnapshots.get(a.addonId)?.name)
          .filter(Boolean);
        const baseName = menuItemMap.get(item.menuItemId)?.name || "Item";
        return {
          name: addonNames.length ? `${baseName} (+${addonNames.join(", ")})` : baseName,
          price: item.priceSnapshot + addonTotal,
          quantity: item.quantity,
        };
      }),
      callbackUrl: `${baseUrl}/api/tripay/callback`,
      returnUrl: `${baseUrl}/order/${order.id}`,
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
