export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
  category: { id: string; name: string };
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  priceSnapshot: number;
  quantity: number;
  notes: string;
}

export interface TableInfo {
  id: string;
  number: number;
  name: string | null;
}

export interface TaxConfig {
  taxEnabled: boolean;
  taxPercentage: number;
  taxLabel: string;
  serviceEnabled: boolean;
  servicePercentage: number;
  serviceLabel: string;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  groupName: string;
  type: string;
  feeCustomer: number;
  minAmount: number | null;
  maxAmount: number | null;
  iconUrl: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: "DINE_IN" | "TAKE_AWAY";
  customerName: string | null;
  subtotal: number;
  serviceAmount: number;
  taxAmount: number;
  grandTotal: number;
  servicePercent: number | null;
  taxPercent: number | null;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  table: { number: number; name: string | null } | null;
  items: OrderItem[];
  transaction: TransactionInfo | null;
}

export interface OrderItem {
  id: string;
  quantity: number;
  priceSnapshot: number;
  notes: string | null;
  menuItem: { name: string; imageUrl: string | null };
}

export interface TransactionInfo {
  reference: string;
  paymentMethod: string;
  payCode: string | null;
  checkoutUrl: string | null;
  qrUrl: string | null;
  qrString: string | null;
  status: string;
  expiredTime: string;
  amount: number;
}

export interface PaymentInstruction {
  title: string;
  steps: string[];
}

export interface RestaurantProfile {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
