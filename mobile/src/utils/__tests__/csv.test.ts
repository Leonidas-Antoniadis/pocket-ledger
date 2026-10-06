import { toCsv } from '../csv';

describe('toCsv', () => {
  it('starts with a UTF-8 BOM and uses CRLF line endings', () => {
    const csv = toCsv(['a', 'b'], [['1', '2']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('a,b\r\n1,2\r\n');
  });

  it('quotes cells containing separators, quotes or newlines', () => {
    const csv = toCsv(['name'], [['Shell, Athens'], ['say "hi"'], ['two\nlines'], ['semi;colon']]);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[1]).toBe('"Shell, Athens"');
    expect(lines[2]).toBe('"say ""hi"""');
    expect(lines[3]).toBe('"two\nlines"');
    expect(lines[4]).toBe('"semi;colon"');
  });

  it('writes empty cells for null and undefined and keeps numbers', () => {
    const csv = toCsv(['a', 'b', 'c'], [[null, undefined, 12.5]]);
    expect(csv.slice(1)).toBe('a,b,c\r\n,,12.5\r\n');
  });

  it('keeps Greek text intact', () => {
    const csv = toCsv(['Κατηγορία'], [['Καύσιμα']]);
    expect(csv).toContain('Κατηγορία\r\nΚαύσιμα');
  });
});
