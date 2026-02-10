const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number): string {
  return INR_FORMATTER.format(amount);
}

export function formatUSD(amount: number): string {
  return USD_FORMATTER.format(amount);
}

export function formatCurrency(
  amount: number,
  currency: "INR" | "USD" = "INR"
): string {
  return currency === "INR" ? formatINR(amount) : formatUSD(amount);
}
