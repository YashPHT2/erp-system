const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function timeZoneOffsetMilliseconds(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(year, month, day, hour, minute, second, timeZone) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offset = timeZoneOffsetMilliseconds(guess, timeZone);
  const utc = new Date(guess.getTime() - offset);
  const corrected = timeZoneOffsetMilliseconds(utc, timeZone);
  if (corrected !== offset) return new Date(guess.getTime() - corrected);
  return utc;
}

function startOfZonedDay(date, timeZone) {
  const parts = getZonedParts(date, timeZone);
  return zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function currentAcademicYear(now, timeZone) {
  const parts = getZonedParts(now, timeZone);
  const start = parts.month >= 6 ? parts.year : parts.year - 1;
  return `${start}-${start + 1}`;
}

function academicYearOptions(now, timeZone) {
  const parts = getZonedParts(now, timeZone);
  const years = [];
  for (let start = parts.year - 2; start <= parts.year + 1; start += 1) {
    years.push(`${start}-${start + 1}`);
  }
  return years;
}

function periodLabel(month, year) {
  return `${MONTHS[month - 1]} ${year}`;
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function recentMonths(now, timeZone, count = 6) {
  const parts = getZonedParts(now, timeZone);
  const months = [];
  let year = parts.year;
  let month = parts.month;
  for (let index = 0; index < count; index += 1) {
    months.push({
      year,
      month,
      key: monthKey(year, month),
      label: SHORT_MONTHS[month - 1],
    });
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return months.reverse();
}

function monthRange(year, month, timeZone) {
  const start = zonedDateTimeToUtc(year, month, 1, 0, 0, 0, timeZone);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = zonedDateTimeToUtc(nextYear, nextMonth, 1, 0, 0, 0, timeZone);
  return { start, end };
}

function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

module.exports = {
  MONTHS,
  SHORT_MONTHS,
  getZonedParts,
  zonedDateTimeToUtc,
  startOfZonedDay,
  addDays,
  currentAcademicYear,
  academicYearOptions,
  periodLabel,
  monthKey,
  recentMonths,
  monthRange,
  parseIsoDate,
};
