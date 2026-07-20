import type { AuthUser } from "./lib/auth.js";

// Make the authenticated user available on every Hono context via c.get("user").
// authMiddleware sets it for the /api/admin/* group; requireRole + handlers read it.
declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}
