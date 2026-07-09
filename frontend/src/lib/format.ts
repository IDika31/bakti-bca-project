const formatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return formatter.format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(date));
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Menunggu Pembayaran",
  CONFIRMED: "Diterima",
  PREPARING: "Sedang Disiapkan",
  READY: "Siap Diambil",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Belum Dibayar",
  PAID: "Lunas",
  FAILED: "Gagal",
  EXPIRED: "Kedaluwarsa",
  REFUND: "Refund",
};
