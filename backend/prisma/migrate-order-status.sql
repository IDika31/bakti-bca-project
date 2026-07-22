-- One-off data migration: remap old OrderStatus values to the new flow.
-- Run this BEFORE `bun run db:push`. It remaps existing rows so that no row
-- still references PENDING/CONFIRMED when db push recreates the enum (Postgres
-- casts the column to the new enum, which would fail on unmapped values).
--
-- New flow: PLACED -> PREPARING -> READY -> PICKED_UP -> COMPLETED (+ CANCELLED)
--   PENDING   -> PLACED     (order placed, awaiting kitchen)
--   CONFIRMED -> PREPARING  (CONFIRMED is removed; treat accepted orders as in-prep)
--
-- Usage (psql):
--   psql "$DATABASE_URL" -f prisma/migrate-order-status.sql
-- then:
--   bun run db:push

BEGIN;

-- Add the new enum values first so the UPDATEs below can target them.
-- (Postgres requires new enum values to exist before they can be assigned.)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PLACED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';

COMMIT;

-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that assigns
-- it, so remap in a separate transaction.
BEGIN;

UPDATE "orders" SET "order_status" = 'PLACED'    WHERE "order_status" = 'PENDING';
UPDATE "orders" SET "order_status" = 'PREPARING' WHERE "order_status" = 'CONFIRMED';

COMMIT;

-- After this script, run `bun run db:push`. Prisma will recreate the enum
-- without PENDING/CONFIRMED; all rows are already remapped so the cast succeeds.
