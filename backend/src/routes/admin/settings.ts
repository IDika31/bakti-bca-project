import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { success, error } from "../../lib/response.js";
import {
  settingsSchema,
  taxConfigSchema,
  operatingHoursSchema,
  tripayConfigSchema,
} from "../../lib/validators.js";
import { deleteImageIfUnused } from "../../lib/storage-cleanup.js";
import { requireRole } from "../../lib/auth.js";

const settingsRoutes = new Hono();
settingsRoutes.use("*", requireRole("OWNER"));

// --- Restaurant Profile ---
settingsRoutes.get("/profile", async (c) => {
  const profile = await prisma.restaurantProfile.findFirst();
  return success(c, profile);
});

settingsRoutes.put("/profile", async (c) => {
  const body = await c.req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return error(c, `Data tidak valid — ${detail}`, 400);
  }

  // Empty string = "clear image". Normalize to null so we store NULL.
  const data = { ...parsed.data };
  if (data.logoUrl === "") data.logoUrl = null;
  if (data.bannerUrl === "") data.bannerUrl = null;

  const existing = await prisma.restaurantProfile.findUnique({ where: { id: "default" } });
  const oldLogo = existing?.logoUrl ?? null;
  const oldBanner = existing?.bannerUrl ?? null;
  const newLogo = data.logoUrl === undefined ? oldLogo : data.logoUrl;
  const newBanner = data.bannerUrl === undefined ? oldBanner : data.bannerUrl;

  const profile = await prisma.restaurantProfile.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });

  // Best-effort cleanup of replaced/cleared logo + banner.
  if (oldLogo && oldLogo !== newLogo) await deleteImageIfUnused(oldLogo);
  if (oldBanner && oldBanner !== newBanner) await deleteImageIfUnused(oldBanner);

  return success(c, profile);
});

// --- Tax & Service ---
settingsRoutes.get("/tax", async (c) => {
  const config = await prisma.taxServiceConfig.findFirst();
  return success(c, config);
});

settingsRoutes.put("/tax", async (c) => {
  const body = await c.req.json();
  const parsed = taxConfigSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return error(c, `Data tidak valid — ${detail}`, 400);
  }

  const config = await prisma.taxServiceConfig.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: { id: "default", ...parsed.data },
  });
  return success(c, config);
});

// --- Operating Hours ---
settingsRoutes.get("/hours", async (c) => {
  const hours = await prisma.operatingHours.findMany({
    orderBy: { dayOfWeek: "asc" },
  });
  return success(c, hours);
});

settingsRoutes.put("/hours", async (c) => {
  const body = await c.req.json();
  const parsed = operatingHoursSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return error(c, `Data tidak valid — ${detail}`, 400);
  }

  for (const h of parsed.data.hours) {
    await prisma.operatingHours.upsert({
      where: { dayOfWeek: h.dayOfWeek },
      update: { openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed },
      create: h,
    });
  }

  const hours = await prisma.operatingHours.findMany({ orderBy: { dayOfWeek: "asc" } });
  return success(c, hours);
});

// --- Tripay Config ---
settingsRoutes.get("/tripay", async (c) => {
  const config = await prisma.tripayConfig.findFirst();
  if (!config) return success(c, null);

  // Mask sensitive keys
  return success(c, {
    id: config.id,
    mode: config.mode,
    sandboxApiKey: config.sandboxApiKey ? "••••" + config.sandboxApiKey.slice(-4) : null,
    sandboxPrivateKey: config.sandboxPrivateKey ? "••••" + config.sandboxPrivateKey.slice(-4) : null,
    sandboxMerchantCode: config.sandboxMerchantCode,
    productionApiKey: config.productionApiKey ? "••••" + config.productionApiKey.slice(-4) : null,
    productionPrivateKey: config.productionPrivateKey ? "••••" + config.productionPrivateKey.slice(-4) : null,
    productionMerchantCode: config.productionMerchantCode,
  });
});

settingsRoutes.put("/tripay", async (c) => {
  const body = await c.req.json();
  const parsed = tripayConfigSchema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return error(c, `Data tidak valid — ${detail}`, 400);
  }

  const config = await prisma.tripayConfig.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: { id: "default", ...parsed.data },
  });
  return success(c, { id: config.id, mode: config.mode });
});

export default settingsRoutes;
