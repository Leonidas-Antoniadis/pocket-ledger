type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  if (value == null) return '';
  const s = String(value);
  if (/[",;\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build CSV text with a UTF-8 BOM so Excel opens Greek characters correctly. */
export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}
