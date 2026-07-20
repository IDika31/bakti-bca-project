import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./lib/auth.js";

import publicRoutes from "./routes/public.js";
import checkoutRoute from "./routes/checkout.js";
import tripayRoutes from "./routes/tripay.js";
import authRoutes from "./routes/admin/auth.js";
import menuRoutes from "./routes/admin/menu.js";
import categoryRoutes from "./routes/admin/categories.js";
import addonRoutes from "./routes/admin/addons.js";
import orderRoutes from "./routes/admin/orders.js";
import tableRoutes from "./routes/admin/tables.js";
import settingsRoutes from "./routes/admin/settings.js";
import paymentRoutes from "./routes/admin/payments.js";
import dashboardRoutes from "./routes/admin/dashboard.js";
import reportRoutes from "./routes/admin/reports.js";
import uploadRoutes from "./routes/admin/upload.js";
import userRoutes from "./routes/admin/users.js";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = process.env.FRONTEND_URL || "http://localhost:3000";
      if (!origin) return allowed;
      const origins = allowed.split(",").map((u) => u.trim());
      if (origins.includes(origin)) return origin;
      if (origin.endsWith(".vercel.app")) return origin;
      return origins[0] ?? allowed;
    },
    credentials: true,
  })
);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// Public routes (no auth)
app.route("/api", publicRoutes);
app.route("/api", checkoutRoute);
app.route("/api", tripayRoutes);

// Admin auth (no middleware)
app.route("/api/admin", authRoutes);

// Admin routes (protected)
const admin = new Hono();
admin.use("*", authMiddleware);
admin.route("/menu", menuRoutes);
admin.route("/categories", categoryRoutes);
admin.route("/addons", addonRoutes);
admin.route("/orders", orderRoutes);
admin.route("/tables", tableRoutes);
admin.route("/settings", settingsRoutes);
admin.route("/payments", paymentRoutes);
admin.route("/dashboard", dashboardRoutes);
admin.route("/reports", reportRoutes);
admin.route("/upload", uploadRoutes);
admin.route("/users", userRoutes);

app.route("/api/admin", admin);

export default app;
