import { z } from "zod/v4";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional(),
});

export const menuItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().int().min(0),
  imageUrl: z.string().url().optional().nullable(),
  isAvailable: z.boolean().optional(),
  categoryId: z.string().uuid(),
});

export const checkoutItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(1),
  priceSnapshot: z.number().int().min(0),
  notes: z.string().max(500).optional(),
});

export const checkoutSchema = z.object({
  sessionId: z.string().min(1),
  orderType: z.enum(["DINE_IN", "TAKE_AWAY"]),
  tableToken: z.string().optional(),
  customerName: z.string().min(1).max(100).optional(),
  customerEmail: z.string().email().optional(),
  paymentMethodCode: z.string().min(1),
  items: z.array(checkoutItemSchema).min(1),
  parentOrderId: z.string().uuid().optional(),
});

export const tableSchema = z.object({
  number: z.number().int().min(1),
  name: z.string().max(50).optional(),
});

export const settingsSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  logoUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
});

export const taxConfigSchema = z.object({
  taxEnabled: z.boolean(),
  taxPercentage: z.number().min(0).max(100),
  taxLabel: z.string().max(50).optional(),
  serviceEnabled: z.boolean(),
  servicePercentage: z.number().min(0).max(100),
  serviceLabel: z.string().max(50).optional(),
});

export const operatingHoursSchema = z.object({
  hours: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      openTime: z.string().regex(/^\d{2}:\d{2}$/),
      closeTime: z.string().regex(/^\d{2}:\d{2}$/),
      isClosed: z.boolean(),
    })
  ),
});

export const tripayConfigSchema = z.object({
  mode: z.enum(["SANDBOX", "PRODUCTION"]),
  sandboxApiKey: z.string().optional(),
  sandboxPrivateKey: z.string().optional(),
  sandboxMerchantCode: z.string().optional(),
  productionApiKey: z.string().optional(),
  productionPrivateKey: z.string().optional(),
  productionMerchantCode: z.string().optional(),
});

export const orderStatusUpdateSchema = z.object({
  orderStatus: z.enum([
    "CONFIRMED",
    "PREPARING",
    "READY",
    "COMPLETED",
    "CANCELLED",
  ]),
});
