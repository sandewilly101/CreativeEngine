import { query, queryOne, execute } from '../config/db.js';
import { config } from '../config/env.js';

/**
 * Exchange rates.
 *
 * The platform stores money in TZS. USD (and any other currency) is a display
 * and document layer on top. Rates come from a free, keyless public API, are
 * cached in `exchange_rates` for the day, and an admin can override any day's
 * rate manually — a manual row always beats the API, because a client who was
 * quoted at an agreed rate should see that rate, not the market's.
 *
 * Verified providers (September 2026):
 *   primary  open.er-api.com        — daily update, no key, CORS enabled
 *   fallback jsDelivr currency-api  — daily update, no key
 */

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'RWF', 'ZAR', 'AED', 'CNY', 'INR'];

let memoryCache = { rates: null, fetchedAt: 0 };
const MEMORY_TTL_MS = 10 * 60 * 1000;

async function fetchFromPrimary() {
  const res = await fetch(config.finance.fxPrimaryUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`primary returned ${res.status}`);
  const json = await res.json();
  if (json.result !== 'success' || !json.rates?.TZS) throw new Error('primary payload missing TZS');
  return { rates: json.rates, source: 'open.er-api.com', date: json.time_last_update_utc };
}

async function fetchFromFallback() {
  const res = await fetch(config.finance.fxFallbackUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`fallback returned ${res.status}`);
  const json = await res.json();
  const usd = json.usd;
  if (!usd?.tzs) throw new Error('fallback payload missing tzs');
  // Normalise lowercase keys to the uppercase shape the primary uses.
  const rates = {};
  for (const [key, value] of Object.entries(usd)) rates[key.toUpperCase()] = value;
  return { rates, source: 'jsdelivr-currency-api', date: json.date };
}

/**
 * Refresh today's rates from the network and store them.
 * Manual overrides for today are left untouched.
 */
export async function refreshRates() {
  let payload;
  try {
    payload = await fetchFromPrimary();
  } catch (primaryErr) {
    console.warn('[fx] primary provider failed:', primaryErr.message);
    try {
      payload = await fetchFromFallback();
    } catch (fallbackErr) {
      console.error('[fx] fallback provider failed too:', fallbackErr.message);
      throw new Error('All exchange rate providers are unreachable');
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const tzsPerUsd = Number(payload.rates.TZS);
  const stored = [];

  for (const code of CURRENCIES) {
    const perUsd = Number(payload.rates[code]);
    if (!perUsd || !Number.isFinite(perUsd)) continue;
    // How many TZS one unit of `code` is worth.
    const rate = code === 'USD' ? tzsPerUsd : tzsPerUsd / perUsd;

    await execute(
      `INSERT INTO exchange_rates (base_currency, quote_currency, rate, source, valid_date, is_manual)
       VALUES (?, 'TZS', ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE
         rate = IF(is_manual = 1, rate, VALUES(rate)),
         source = IF(is_manual = 1, source, VALUES(source)),
         fetched_at = CURRENT_TIMESTAMP`,
      [code, Number(rate.toFixed(6)), payload.source, today]
    );
    stored.push({ currency: code, tzs: Number(rate.toFixed(6)) });
  }

  memoryCache = { rates: null, fetchedAt: 0 };
  return { source: payload.source, providerDate: payload.date, rates: stored };
}

/** All current rates as { USD: 2645.12, EUR: ... } — TZS per one unit. */
export async function getRates() {
  if (memoryCache.rates && Date.now() - memoryCache.fetchedAt < MEMORY_TTL_MS) {
    return memoryCache.rates;
  }

  let rows = await query(
    `SELECT base_currency, rate, is_manual, valid_date, source
       FROM exchange_rates
      WHERE quote_currency = 'TZS'
        AND valid_date = (SELECT MAX(valid_date) FROM exchange_rates WHERE quote_currency = 'TZS')`
  );

  // Cold start, or the cache has gone stale: pull fresh rates.
  const staleBy = rows.length
    ? (Date.now() - new Date(rows[0].valid_date).getTime()) / 3600000
    : Infinity;

  if (!rows.length || staleBy > config.finance.fxRefreshHours) {
    try {
      await refreshRates();
      rows = await query(
        `SELECT base_currency, rate, is_manual, valid_date, source
           FROM exchange_rates
          WHERE quote_currency = 'TZS'
            AND valid_date = (SELECT MAX(valid_date) FROM exchange_rates WHERE quote_currency = 'TZS')`
      );
    } catch (err) {
      // Network down: serve whatever is cached rather than failing the request.
      console.warn('[fx] serving stale rates:', err.message);
    }
  }

  const rates = { TZS: 1 };
  for (const row of rows) rates[row.base_currency] = Number(row.rate);

  memoryCache = { rates, fetchedAt: Date.now() };
  return rates;
}

/** TZS per one unit of `currency`. */
export async function getRate(currency) {
  if (!currency || currency === 'TZS') return 1;
  const rates = await getRates();
  const rate = rates[currency.toUpperCase()];
  if (!rate) throw new Error(`No exchange rate available for ${currency}`);
  return rate;
}

/** Convert an amount in cents between two currencies. */
export async function convert(cents, from = 'TZS', to = 'TZS') {
  if (from === to) return Number(cents);
  const fromRate = await getRate(from);
  const toRate = await getRate(to);
  return Math.round((Number(cents) * fromRate) / toRate);
}

/** Admin override for a specific day. */
export async function setManualRate(currency, tzsRate, validDate = null) {
  const date = validDate || new Date().toISOString().slice(0, 10);
  await execute(
    `INSERT INTO exchange_rates (base_currency, quote_currency, rate, source, valid_date, is_manual)
     VALUES (?, 'TZS', ?, 'manual', ?, 1)
     ON DUPLICATE KEY UPDATE rate = VALUES(rate), is_manual = 1, source = 'manual',
                             fetched_at = CURRENT_TIMESTAMP`,
    [currency.toUpperCase(), Number(tzsRate), date]
  );
  memoryCache = { rates: null, fetchedAt: 0 };
  return { currency: currency.toUpperCase(), rate: Number(tzsRate), valid_date: date, is_manual: true };
}

export async function clearManualRate(currency, validDate = null) {
  const date = validDate || new Date().toISOString().slice(0, 10);
  await execute(
    `UPDATE exchange_rates SET is_manual = 0 WHERE base_currency = ? AND quote_currency = 'TZS' AND valid_date = ?`,
    [currency.toUpperCase(), date]
  );
  memoryCache = { rates: null, fetchedAt: 0 };
  await refreshRates().catch(() => {});
  return { cleared: true };
}

export async function getRateHistory(currency = 'USD', days = 30) {
  return query(
    `SELECT valid_date, rate, source, is_manual
       FROM exchange_rates
      WHERE base_currency = ? AND quote_currency = 'TZS'
      ORDER BY valid_date DESC
      LIMIT ?`,
    [currency.toUpperCase(), Number(days)]
  );
}

/** Kick off a periodic refresh. Called once at server start. */
export function startFxScheduler() {
  const intervalMs = config.finance.fxRefreshHours * 3600 * 1000;
  refreshRates()
    .then((r) => console.log(`[fx] rates loaded from ${r.source} — USD 1 = TZS ${r.rates.find((x) => x.currency === 'USD')?.tzs}`))
    .catch((err) => console.warn('[fx] initial load failed:', err.message));

  const timer = setInterval(() => {
    refreshRates().catch((err) => console.warn('[fx] scheduled refresh failed:', err.message));
  }, intervalMs);
  timer.unref?.();
  return timer;
}
