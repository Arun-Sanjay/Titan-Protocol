export type MoneyCurrency = "USD" | "EUR" | "GBP" | "INR";

const SYMBOLS: Record<MoneyCurrency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
};

export function formatMoney(amount: number, currency: MoneyCurrency): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const symbol = SYMBOLS[currency] ?? "$";
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(safeAmount);
  return `${symbol}${formatted}`;
}

export function currencySymbol(currency: MoneyCurrency): string {
  return SYMBOLS[currency] ?? "$";
}
