import { isRealIsoDate } from "./academic-calendar-validation";

export type AcademicCalendarPeriodUnit = "month" | "month_week";

export type AcademicCalendarPeriod<TEvent> = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  events: TEvent[];
};

type DatedCalendarEvent = {
  startDate: string;
  endDate?: string;
};

export function groupAcademicCalendarEventsByPeriod<TEvent extends DatedCalendarEvent>(
  events: readonly TEvent[],
  unit: AcademicCalendarPeriodUnit,
): AcademicCalendarPeriod<TEvent>[] {
  const periods = new Map<string, AcademicCalendarPeriod<TEvent>>();

  for (const event of events) {
    if (!isRealIsoDate(event.startDate) || (event.endDate && !isRealIsoDate(event.endDate))) {
      continue;
    }

    const start = parseDate(event.startDate);
    const end = parseDate(event.endDate ?? event.startDate);
    if (end < start) {
      continue;
    }

    const eventPeriods = unit === "month" ? getMonthsInRange(start, end) : getWeeksInRange(start, end);
    for (const period of eventPeriods) {
      const existing = periods.get(period.key);
      if (existing) {
        existing.events.push(event);
      } else {
        periods.set(period.key, { ...period, events: [event] });
      }
    }
  }

  return [...periods.values()].sort((left, right) => left.startDate.localeCompare(right.startDate));
}

function getMonthsInRange(start: Date, end: Date): Array<Omit<AcademicCalendarPeriod<never>, "events">> {
  const periods: Array<Omit<AcademicCalendarPeriod<never>, "events">> = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const finalMonth = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);

  while (cursor.getTime() <= finalMonth) {
    const year = cursor.getUTCFullYear();
    const monthIndex = cursor.getUTCMonth();
    const month = monthIndex + 1;
    periods.push({
      key: `${year}-${pad(month)}`,
      label: `${month}월`,
      startDate: formatDate(cursor),
      endDate: formatDate(new Date(Date.UTC(year, monthIndex + 1, 0))),
    });
    cursor = new Date(Date.UTC(year, monthIndex + 1, 1));
  }

  return periods;
}

function getWeeksInRange(start: Date, end: Date): Array<Omit<AcademicCalendarPeriod<never>, "events">> {
  const periods: Array<Omit<AcademicCalendarPeriod<never>, "events">> = [];
  let cursor = startOfMondayWeek(start);

  while (cursor <= end) {
    const thursday = addDays(cursor, 3);
    const ownerMonth = thursday.getUTCMonth() + 1;
    const weekNumber = Math.ceil(thursday.getUTCDate() / 7);
    periods.push({
      key: `${thursday.getUTCFullYear()}-${pad(ownerMonth)}-w${weekNumber}`,
      label: `${ownerMonth}월 ${weekNumber}주`,
      startDate: formatDate(cursor),
      endDate: formatDate(addDays(cursor, 6)),
    });
    cursor = addDays(cursor, 7);
  }

  return periods;
}

function startOfMondayWeek(date: Date): Date {
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return addDays(date, -daysSinceMonday);
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
