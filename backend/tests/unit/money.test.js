const { parseRupees, fromPaise, rupeeString } = require('../../utils/money');

describe('money', () => {
  test('parses rupee amounts into paise', () => {
    expect(parseRupees('10.50')).toBe(1050);
    expect(parseRupees('10.5')).toBe(1050);
    expect(parseRupees(10)).toBe(1000);
    expect(parseRupees('0', { allowZero: true })).toBe(0);
  });

  test('rejects negative, zero, and over-precise amounts', () => {
    expect(() => parseRupees('-1')).toThrow(/non-negative/);
    expect(() => parseRupees('1.234')).toThrow(/2 decimal/);
    expect(() => parseRupees('')).toThrow(/non-negative/);
    expect(() => parseRupees('0')).toThrow(/greater than zero/);
    expect(() => parseRupees('01.50')).toThrow(/valid amount/);
  });

  test('converts paise back to rupees', () => {
    expect(fromPaise(1050)).toBe(10.5);
    expect(fromPaise(10)).toBe(0.1);
    expect(rupeeString(10)).toBe('0.10');
  });
});
