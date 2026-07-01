export function formatMoney(cents: number, currency = "CAD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatCAD(cents: number): string {
  return formatMoney(cents, "CAD")
}
