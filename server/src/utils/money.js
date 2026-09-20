/**
 * Money handling.
 *
 * Every monetary value in this platform is stored as an integer number of
 * minor units ("cents") in the TZS base. The shilling has no circulating
 * subunit in practice, but keeping two implied decimals means percentage
 * maths (VAT at 18%, discounts, per-sqm rates) never accumulates rounding
 * error the way floating point would.
 *
 *   1_000_000 cents === TZS 10,000.00
 */

export const CENTS_PER_UNIT = 100;

/** TZS 10,000 -> 1_000_000 cents */
export function toCents(amount) {
  if (amount === null || amount === undefined || amount === '') return 0;
  return Math.round(Number(amount) * CENTS_PER_UNIT);
}

/** 1_000_000 cents -> 10000 */
export function fromCents(cents) {
  return Number(cents || 0) / CENTS_PER_UNIT;
}

/** Percentage of a cent amount, rounded to the nearest cent. */
export function percentOf(cents, percent) {
  return Math.round((Number(cents || 0) * Number(percent || 0)) / 100);
}

/**
 * Compute a document total from line items.
 * Discount is applied before VAT, which is how TRA expects it presented.
 */
export function calculateTotals({
  items = [],
  discountType = 'none',
  discountValue = 0,
  vatRate = 18,
  extraCharges = 0,
}) {
  const subtotal = items.reduce((sum, item) => {
    const qty = Number(item.quantity ?? 1);
    const unit = Number(item.unit_price_cents ?? 0);
    return sum + Math.round(qty * unit);
  }, 0);

  let discount = 0;
  if (discountType === 'percent') discount = percentOf(subtotal, discountValue);
  else if (discountType === 'fixed') discount = Number(discountValue || 0);
  discount = Math.min(discount, subtotal);

  const charges = Number(extraCharges || 0);
  const taxableBase = items.reduce((sum, item) => {
    if (item.is_taxable === 0 || item.is_taxable === false) return sum;
    const qty = Number(item.quantity ?? 1);
    const unit = Number(item.unit_price_cents ?? 0);
    return sum + Math.round(qty * unit);
  }, 0);

  // Spread the discount proportionally across the taxable portion.
  const discountOnTaxable = subtotal > 0
    ? Math.round((discount * taxableBase) / subtotal)
    : 0;

  const vat = percentOf(taxableBase - discountOnTaxable + charges, vatRate);
  const total = subtotal - discount + charges + vat;

  return {
    subtotal_cents: subtotal,
    discount_cents: discount,
    vat_cents: vat,
    total_cents: total,
  };
}

/** Area in square metres from millimetre dimensions, for large format print. */
export function areaSqm(widthMm, heightMm, quantity = 1) {
  const w = Number(widthMm || 0) / 1000;
  const h = Number(heightMm || 0) / 1000;
  return Number((w * h * Number(quantity || 1)).toFixed(4));
}

/**
 * Format for display. The API generally returns raw cents and lets the client
 * format, but invoices and emails rendered server-side use this.
 */
export function formatMoney(cents, currency = 'TZS', locale = 'en-TZ') {
  const value = fromCents(cents);
  const fractionDigits = currency === 'TZS' ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })}`;
  }
}

/** Convert cents between currencies using a TZS-anchored rate. */
export function convertCents(cents, fromRateToTzs, toRateToTzs) {
  if (!toRateToTzs) return Number(cents || 0);
  const inTzs = Number(cents || 0) * Number(fromRateToTzs || 1);
  return Math.round(inTzs / Number(toRateToTzs));
}
