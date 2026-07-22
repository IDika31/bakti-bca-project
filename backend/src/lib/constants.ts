export const ORDER_STATUS_LABELS: Record<string, string> = {
  PLACED: "Pesanan Masuk",
  PREPARING: "Sedang Disiapkan",
  READY: "Siap Diambil",
  PICKED_UP: "Sudah Diambil",
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

export const ORDER_TYPE_LABELS: Record<string, string> = {
  DINE_IN: "Makan di Tempat",
  TAKE_AWAY: "Bawa Pulang",
};

export const DAY_LABELS = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];

export const PAYMENT_EXPIRY_MINUTES = 30;
export const AMOUNT_TOLERANCE = 100; // Rp 100
export const POLLING_INTERVAL_MS = 5000;
