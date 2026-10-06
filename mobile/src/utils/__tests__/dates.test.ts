import {
  fileTimestamp,
  formatDate,
  formatMonth,
  fromISODate,
  isValidMonthKey,
  monthKeyOf,
  monthsOfYear,
  shiftMonth,
  toISODate,
  yearOf,
} from '../dates';

describe('ISO date helpers', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 9, 6))).toBe('2026-10-06');
    expect(toISODate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('round-trips through fromISODate at local midnight', () => {
    const date = fromISODate('2026-02-28');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(28);
    expect(date.getHours()).toBe(0);
    expect(toISODate(date)).toBe('2026-02-28');
  });

  it('derives the month key used for receipt folders', () => {
    expect(monthKeyOf('2026-10-06')).toBe('2026-10');
    expect(yearOf('2026-10')).toBe(2026);
  });
});

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-06', 0)).toBe('2026-06');
    expect(shiftMonth('2026-03', -15)).toBe('2024-12');
  });
});

describe('monthsOfYear / isValidMonthKey', () => {
  it('lists twelve zero-padded months', () => {
    const months = monthsOfYear(2026);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-01');
    expect(months[11]).toBe('2026-12');
    expect(months.every(isValidMonthKey)).toBe(true);
  });

  it('rejects malformed keys', () => {
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey('2026-1')).toBe(false);
    expect(isValidMonthKey('receipts')).toBe(false);
  });
});

describe('formatting', () => {
  it('formats months and dates for the locale', () => {
    expect(formatMonth('2026-10', 'en-GB')).toBe('October 2026');
    expect(formatMonth('2026-10', 'el-GR')).toMatch(/2026/);
    expect(formatDate('2026-10-06', 'en-GB')).toBe('6 Oct 2026');
  });

  it('produces file-name safe timestamps', () => {
    expect(fileTimestamp(new Date(2026, 9, 6, 14, 3, 9))).toBe('2026-10-06_14-03-09');
  });
});
