import { centsToInput, formatBytes, formatMoney, formatSignedMoney, parseAmountToCents } from '../money';

describe('parseAmountToCents', () => {
  it.each([
    ['12.50', 1250],
    ['12,50', 1250],
    ['12', 1200],
    ['0.1', 10],
    ['7,9', 790],
    ['1.250,00', 125000],
    ['1,250.00', 125000],
    ['1,000,000', 100000000],
    ['1.000.000', 100000000],
    [' € 45,30 ', 4530],
    ['12.', 1200],
    ['.5', 50],
  ])('parses %p as %p cents', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it('rounds to whole cents without floating-point drift', () => {
    expect(parseAmountToCents('1.005')).toBe(101);
    expect(parseAmountToCents('2.999')).toBe(300);
    expect(parseAmountToCents('12.345')).toBe(1235);
    expect(parseAmountToCents('0.004')).toBe(0);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseAmountToCents('')).toBeNull();
    expect(parseAmountToCents('   ')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents('.')).toBeNull();
  });
});

describe('centsToInput', () => {
  it('formats cents with two decimals using a dot', () => {
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(5)).toBe('0.05');
    expect(centsToInput(0)).toBe('0.00');
  });

  it('returns an empty string for missing values', () => {
    expect(centsToInput(null)).toBe('');
    expect(centsToInput(undefined)).toBe('');
  });
});

describe('formatMoney', () => {
  it('formats with the currency symbol for the locale', () => {
    expect(formatMoney(1250, 'EUR', 'en-GB')).toBe('€12.50');
    expect(formatMoney(1250, 'EUR', 'el-GR')).toContain('12,50');
  });

  it('falls back to EUR when the currency code is invalid', () => {
    expect(formatMoney(100, 'NOT_A_CURRENCY', 'en')).toBe('€1.00');
  });

  it('prefixes a sign for signed amounts', () => {
    expect(formatSignedMoney(1250, 'income', 'EUR', 'en-GB')).toBe('+€12.50');
    expect(formatSignedMoney(1250, 'expense', 'EUR', 'en-GB')).toBe('-€12.50');
  });
});

describe('formatBytes', () => {
  it('picks a sensible unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
