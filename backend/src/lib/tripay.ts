import { createHmac } from "crypto";
import { prisma } from "./prisma.js";
import { PAYMENT_EXPIRY_MINUTES } from "./constants.js";

interface TripayCredentials {
  apiKey: string;
  privateKey: string;
  merchantCode: string;
  baseUrl: string;
}

export async function getTripayConfig(): Promise<TripayCredentials> {
  const config = await prisma.tripayConfig.findFirst();
  if (!config) throw new Error("Tripay belum dikonfigurasi");

  const isSandbox = config.mode === "SANDBOX";
  const apiKey = isSandbox ? config.sandboxApiKey : config.productionApiKey;
  const privateKey = isSandbox
    ? config.sandboxPrivateKey
    : config.productionPrivateKey;
  const merchantCode = isSandbox
    ? config.sandboxMerchantCode
    : config.productionMerchantCode;

  if (!apiKey || !privateKey || !merchantCode) {
    throw new Error(
      `Kredensial Tripay ${isSandbox ? "Sandbox" : "Production"} belum lengkap`
    );
  }

  return {
    apiKey,
    privateKey,
    merchantCode,
    baseUrl: isSandbox
      ? "https://tripay.co.id/api-sandbox"
      : "https://tripay.co.id/api",
  };
}

export function generateSignature(
  merchantCode: string,
  merchantRef: string,
  amount: number,
  privateKey: string
): string {
  return createHmac("sha256", privateKey)
    .update(merchantCode + merchantRef + amount)
    .digest("hex");
}

export function verifyCallbackSignature(
  rawBody: string,
  receivedSignature: string,
  privateKey: string
): boolean {
  const computed = createHmac("sha256", privateKey)
    .update(rawBody)
    .digest("hex");
  return computed === receivedSignature;
}

interface CreateTransactionParams {
  method: string;
  merchantRef: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  orderItems: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  callbackUrl: string;
  returnUrl: string;
}

export async function createTransaction(params: CreateTransactionParams) {
  const config = await getTripayConfig();
  const signature = generateSignature(
    config.merchantCode,
    params.merchantRef,
    params.amount,
    config.privateKey
  );

  const expiredTime = Math.floor(Date.now() / 1000) + PAYMENT_EXPIRY_MINUTES * 60;

  const body = {
    method: params.method,
    merchant_ref: params.merchantRef,
    amount: params.amount,
    customer_name: params.customerName,
    customer_email: params.customerEmail,
    order_items: params.orderItems.map((item) => ({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    })),
    callback_url: params.callbackUrl,
    return_url: params.returnUrl,
    expired_time: expiredTime,
    signature,
  };

  const res = await fetch(`${config.baseUrl}/transaction/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Gagal membuat transaksi Tripay");
  }

  return data.data;
}

export async function syncPaymentChannels() {
  const config = await getTripayConfig();

  const res = await fetch(`${config.baseUrl}/merchant/payment-channel`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Gagal sinkronisasi channel pembayaran");
  }

  const channels = data.data as Array<{
    code: string;
    name: string;
    group: string;
    type: string;
    fee_merchant: { flat: number; percent: number };
    fee_customer: { flat: number; percent: number };
    minimum_amount: number;
    maximum_amount: number;
    icon_url: string;
    active: boolean;
  }>;

  for (const ch of channels) {
    await prisma.paymentMethod.upsert({
      where: { code: ch.code },
      update: {
        name: ch.name,
        groupName: ch.group,
        type: ch.type,
        feeMerchant: ch.fee_merchant.flat,
        feeCustomer: ch.fee_customer.flat,
        minAmount: ch.minimum_amount,
        maxAmount: ch.maximum_amount,
        iconUrl: ch.icon_url,
        isActive: ch.active,
        lastSyncedAt: new Date(),
      },
      create: {
        code: ch.code,
        name: ch.name,
        groupName: ch.group,
        type: ch.type,
        feeMerchant: ch.fee_merchant.flat,
        feeCustomer: ch.fee_customer.flat,
        minAmount: ch.minimum_amount,
        maxAmount: ch.maximum_amount,
        iconUrl: ch.icon_url,
        isActive: ch.active,
        isShown: true,
        lastSyncedAt: new Date(),
      },
    });
  }

  return channels.length;
}

export async function checkTransactionStatus(reference: string) {
  const config = await getTripayConfig();

  const res = await fetch(
    `${config.baseUrl}/transaction/detail?reference=${reference}`,
    { headers: { Authorization: `Bearer ${config.apiKey}` } }
  );

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || "Gagal cek status transaksi");
  }

  return data.data;
}
