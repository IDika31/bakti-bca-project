import { prisma } from "./prisma.js";

// A device lock left behind by someone who scanned but never ordered (or
// abandoned the table) is auto-reclaimable after this window. Normal release
// happens when the order reaches a terminal state; this is only a fallback so
// a table can never be wedged forever.
export const LOCK_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

// Statuses that still hold the table. Anything else is terminal → lock frees.
const ACTIVE_ORDER_STATUSES = ["PLACED", "PREPARING", "READY", "PICKED_UP"] as const;

/**
 * Decide whether a lock held by `lockedSessionId` may be taken over by the
 * requesting `sessionId`. A lock is reclaimable when:
 *  - it is unheld, or
 *  - it is held by the same session, or
 *  - the holder has no active order on this table AND the lock is stale.
 */
export async function canClaimLock(
  table: { id: string; lockedSessionId: string | null; lockedAt: Date | null },
  sessionId: string
): Promise<boolean> {
  if (!table.lockedSessionId) return true;
  if (table.lockedSessionId === sessionId) return true;

  const activeOrder = await prisma.order.findFirst({
    where: {
      tableId: table.id,
      sessionId: table.lockedSessionId,
      orderStatus: { in: [...ACTIVE_ORDER_STATUSES] },
    },
    select: { id: true },
  });
  if (activeOrder) return false; // holder is mid-order — truly blocked

  const stale = !table.lockedAt || Date.now() - table.lockedAt.getTime() > LOCK_STALE_MS;
  return stale;
}

/**
 * Release the table lock tied to a just-terminated order, but only if this
 * order's session still owns it (don't yank a lock a newer device took over).
 */
export async function releaseLockForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { tableId: true, sessionId: true },
  });
  if (!order?.tableId) return;

  await prisma.table.updateMany({
    where: { id: order.tableId, lockedSessionId: order.sessionId },
    data: { lockedSessionId: null, lockedAt: null },
  });
}
