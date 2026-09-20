export type AcademicCalendarMonthIdentity = {
  key: string;
  label: string;
  month: number;
  startDate: string;
  endDate: string;
};

export type AcademicCalendarWeekIdentity = AcademicCalendarMonthIdentity & {
  week: number;
};

export function parseAcademicCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function formatAcademicCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addAcademicCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function startOfAcademicCalendarMondayWeek(date: Date): Date {
  const day = date.getUTCDay();
  return addAcademicCalendarDays(date, -(day === 0 ? 6 : day - 1));
}

export function createAcademicCalendarMonthIdentity(date: Date): AcademicCalendarMonthIdentity {
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const month = monthIndex + 1;
  return {
    key: `${year}-${pad(month)}`,
    label: `${month}월`,
    month,
    startDate: formatAcademicCalendarDate(new Date(Date.UTC(year, monthIndex, 1))),
    endDate: formatAcademicCalendarDate(new Date(Date.UTC(year, monthIndex + 1, 0))),
  };
}

export function createAcademicCalendarWeekIdentity(date: Date): AcademicCalendarWeekIdentity {
  const monday = startOfAcademicCalendarMondayWeek(date);
  const thursday = addAcademicCalendarDays(monday, 3);
  const month = thursday.getUTCMonth() + 1;
  const week = Math.ceil(thursday.getUTCDate() / 7);
  return {
    key: `${thursday.getUTCFullYear()}-${pad(month)}-w${week}`,
    label: `${month}월 ${week}주`,
    month,
    week,
    startDate: formatAcademicCalendarDate(monday),
    endDate: formatAcademicCalendarDate(addAcademicCalendarDays(monday, 6)),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
