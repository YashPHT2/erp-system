const {
  zonedDateTimeToUtc,
  startOfZonedDay,
  currentAcademicYear,
  recentMonths,
} = require('../../utils/dates');

describe('dates', () => {
  test('converts an India local midnight to UTC', () => {
    const utc = zonedDateTimeToUtc(2026, 10, 31, 0, 0, 0, 'Asia/Kolkata');
    expect(utc.toISOString()).toBe('2026-10-30T18:30:00.000Z');
  });

  test('finds the start of the zoned day', () => {
    const start = startOfZonedDay(new Date('2026-10-31T10:00:00.000Z'), 'Asia/Kolkata');
    expect(start.toISOString()).toBe('2026-10-30T18:30:00.000Z');
  });

  test('uses June as the start of the academic year', () => {
    expect(currentAcademicYear(new Date('2026-10-31T10:00:00.000Z'), 'Asia/Kolkata')).toBe('2026-2027');
    expect(currentAcademicYear(new Date('2026-03-01T10:00:00.000Z'), 'Asia/Kolkata')).toBe('2025-2026');
  });

  test('returns recent months ending with the current month', () => {
    const months = recentMonths(new Date('2026-10-31T10:00:00.000Z'), 'Asia/Kolkata', 6);
    expect(months).toHaveLength(6);
    expect(months[months.length - 1]).toMatchObject({ year: 2026, month: 10, label: 'Oct' });
    expect(months[0]).toMatchObject({ year: 2026, month: 5, label: 'May' });
  });
});
