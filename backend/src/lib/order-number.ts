import { prisma } from "./prisma.js";
import { format } from "date-fns";

export async function generateOrderNumber(): Promise<string> {
  const today = format(new Date(), "yyyyMMdd");
  const prefix = `ORD-${today}-`;

  const lastOrder = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let seq = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderNumber.slice(prefix.length), 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${seq.toString().padStart(4, "0")}`;
}
