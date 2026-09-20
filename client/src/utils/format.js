/**
 * Formatting helpers.
 *
 * Money is stored in TZS minor units everywhere in this platform. These
 * helpers convert to a display currency using rates fetched from the API,
 * which in turn come from a live public FX feed.
 */

let rates = { TZS: 1 };

export function setRates(next) {
  rates = { TZS: 1, ...next };
}

export function getRates() {
  return rates;
}

/** How many TZS one unit of `currency` is worth. */
export function rateFor(currency) {
  return rates[currency] || 1;
}

/**
 * Format an amount held in `fromCurrency` cents for display in `toCurrency`.
 * The shilling is shown without decimals — nobody quotes cents in TZS.
 */
export function money(cents, toCurrency = 'TZS', fromCurrency = 'TZS') {
  const value = Number(cents || 0) / 100;
  let converted = value;

  if (fromCurrency !== toCurrency) {
    const inTzs = value * rateFor(fromCurrency);
    converted = inTzs / rateFor(toCurrency);
  }

  const decimals = toCurrency === 'TZS' ? 0 : 2;
  const formatted = converted.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${toCurrency} ${formatted}`;
}

/** Compact form for dashboard tiles: TZS 2.4M rather than TZS 2,400,000. */
export function moneyCompact(cents, currency = 'TZS', fromCurrency = 'TZS') {
  const value = Number(cents || 0) / 100;
  let converted = value;
  if (fromCurrency !== currency) {
    converted = (value * rateFor(fromCurrency)) / rateFor(currency);
  }

  const abs = Math.abs(converted);
  if (abs >= 1_000_000_000) return `${currency} ${(converted / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${currency} ${(converted / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${currency} ${(converted / 1_000).toFixed(0)}K`;
  return `${currency} ${converted.toFixed(currency === 'TZS' ? 0 : 2)}`;
}

/** Parse what a user typed into cents. Accepts "1,200,000" and "1.2m". */
export function parseMoney(input) {
  if (input === null || input === undefined || input === '') return 0;
  let text = String(input).trim().replace(/[, ]/g, '').toLowerCase();
  let multiplier = 1;
  if (text.endsWith('m')) { multiplier = 1_000_000; text = text.slice(0, -1); }
  else if (text.endsWith('k')) { multiplier = 1_000; text = text.slice(0, -1); }
  const value = parseFloat(text);
  return Number.isFinite(value) ? Math.round(value * multiplier * 100) : 0;
}

export function number(value, decimals = 0) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function percent(value, decimals = 1) {
  return `${Number(value || 0).toFixed(decimals)}%`;
}

// ------------------------------------------------------------------- DATES
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function date(value, style = 'medium') {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';

  if (style === 'short') return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (style === 'long') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (style === 'iso') return d.toISOString().slice(0, 10);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function dateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date(value)}, ${time}`;
}

export function timeAgo(value) {
  if (!value) return '—';
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function daysUntil(value) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

export function dateRange(start, end) {
  if (!start) return '—';
  if (!end) return date(start);
  const s = new Date(start);
  const e = new Date(end);
  if (s.toDateString() === e.toDateString()) return date(start);
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    return `${s.getDate()}–${e.getDate()} ${MONTHS[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${date(start, 'short')} – ${date(end)}`;
}

// -------------------------------------------------------------------- MISC
export function initials(first, last) {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';
}

export function fileSize(bytes) {
  const b = Number(bytes || 0);
  if (b === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** "in_production" -> "In production" */
export function humanise(value) {
  if (!value) return '';
  const text = String(value).replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function truncate(text, length = 80) {
  const str = String(text || '');
  return str.length > length ? `${str.slice(0, length).trimEnd()}…` : str;
}

/** Status colours shared by badges across the whole admin. */
export const STATUS_TONE = {
  // generic
  draft: 'neutral', active: 'success', archived: 'neutral', cancelled: 'danger',
  // quotes / invoices
  sent: 'info', viewed: 'info', accepted: 'success', rejected: 'danger',
  expired: 'warning', revised: 'neutral', paid: 'success', partial: 'warning',
  overdue: 'danger', refunded: 'neutral',
  // projects
  planning: 'neutral', on_hold: 'warning', review: 'info', completed: 'success',
  on_track: 'success', at_risk: 'warning', off_track: 'danger',
  // tasks
  todo: 'neutral', in_progress: 'info', blocked: 'danger', done: 'success',
  // leads
  new: 'info', contacted: 'neutral', qualified: 'brand', proposal_sent: 'info',
  won: 'success', lost: 'danger', spam: 'neutral',
  // bookings
  enquiry: 'neutral', quoted: 'info', confirmed: 'success', dispatched: 'brand',
  on_hire: 'brand', returned: 'info',
  // print
  artwork_pending: 'warning', preflight: 'info', proof_sent: 'info',
  approved: 'success', in_production: 'brand', ready: 'success', delivered: 'success',
  // deliverables
  in_review: 'warning', changes_requested: 'danger',
  // subscriptions
  trial: 'info', past_due: 'danger', paused: 'warning',
};

export function statusTone(status) {
  return STATUS_TONE[status] || 'neutral';
}
