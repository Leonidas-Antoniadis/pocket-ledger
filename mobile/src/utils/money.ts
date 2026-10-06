/**
 * Parse a user-typed amount into integer cents.
 * Accepts "12.50", "12,50", "1.250,00", "1,250.00" and "12"; returns null when invalid.
 */
export function parseAmountToCents(input: string): number | null {
  const s = input.replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!s) return null;

  const commas = (s.match(/,/g) ?? []).length;
  const dots = (s.match(/\./g) ?? []).length;
  let normalized = s;

  if (commas > 0 && dots > 0) {
    const decimalSep = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalized = s.split(thousandsSep).join('').replace(decimalSep, '.');
  } else if (commas === 1) {
    normalized = s.replace(',', '.');
  } else if (commas > 1) {
    normalized = s.split(',').join('');
  } else if (dots > 1) {
    normalized = s.split('.').join('');
  }

  if (!/\d/.test(normalized) || !/^\d*(\.\d*)?$/.test(normalized)) return null;

  // Work on the digits as text so "1.005" rounds to 101 cents (floating point would give 100.49999…).
  const [intPart, fracPart = ''] = normalized.split('.');
  const whole = intPart ? Number(intPart) : 0;
  const fraction = fracPart.padEnd(3, '0');
  const cents = Number(fraction.slice(0, 2));
  const roundUp = Number(`0.${fraction.slice(2)}`) >= 0.5 ? 1 : 0;
  const total = whole * 100 + cents + roundUp;
  return Number.isSafeInteger(total) ? total : null;
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

const formatterCache = new Map<string, Intl.NumberFormat>();

export function formatMoney(cents: number, currency: string, locale: string): string {
  const key = `${locale}|${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    } catch {
      formatter = new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' });
    }
    formatterCache.set(key, formatter);
  }
  return formatter.format(cents / 100);
}

export function formatSignedMoney(
  cents: number,
  kind: 'expense' | 'income',
  currency: string,
  locale: string,
): string {
  const sign = kind === 'income' ? '+' : '-';
  return `${sign}${formatMoney(Math.abs(cents), currency, locale)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
