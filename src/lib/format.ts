export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch (_err) {
    return '';
  }
}

/**
 * Format amount and currency code with Intl fallback.
 * Accepts numeric or string amounts. If amount cannot be parsed,
 * falls back to `${amount} ${currency}`.
 */
export function formatCurrency(
  amount: number | string | undefined | null,
  currency?: string | null,
  locale: string = 'en-US'
) {
  if (amount == null || amount === '') return '';
  const code = (currency || '').toString().toUpperCase() || 'USD';
  const num =
    typeof amount === 'number'
      ? amount
      : Number(String(amount).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(num)) return `${amount} ${code}`.trim();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2
    }).format(num);
  } catch {
    return `${num} ${code}`.trim();
  }
}
