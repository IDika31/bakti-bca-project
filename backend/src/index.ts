import app from "./app.js";

// Local dev bootstrap (Bun): `bun run --hot src/index.ts`
// Vercel entry point is in `api/[[...path]].ts`.
export default {
  port: Number(process.env.PORT) || 3001,
  fetch: app.fetch,
};
