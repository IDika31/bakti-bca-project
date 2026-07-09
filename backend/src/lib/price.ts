interface TaxServiceInput {
  taxEnabled: boolean;
  taxPercentage: number;
  serviceEnabled: boolean;
  servicePercentage: number;
}

interface PriceBreakdown {
  subtotal: number;
  serviceAmount: number;
  taxAmount: number;
  grandTotal: number;
}

export function calculatePrice(
  subtotal: number,
  config: TaxServiceInput
): PriceBreakdown {
  const serviceAmount = config.serviceEnabled
    ? Math.round(subtotal * (config.servicePercentage / 100))
    : 0;

  const taxAmount = config.taxEnabled
    ? Math.round(subtotal * (config.taxPercentage / 100))
    : 0;

  return {
    subtotal,
    serviceAmount,
    taxAmount,
    grandTotal: subtotal + serviceAmount + taxAmount,
  };
}
