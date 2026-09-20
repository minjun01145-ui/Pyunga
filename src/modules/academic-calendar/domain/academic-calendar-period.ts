import { isRealIsoDate } from "./academic-calendar-validation";
import {
  addAcademicCalendarDays,
  createAcademicCalendarMonthIdentity,
  createAcademicCalendarWeekIdentity,
  parseAcademicCalendarDate,
  startOfAcademicCalendarMondayWeek,
} from "./academic-calendar-date";

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

    const start = parseAcademicCalendarDate(event.startDate);
    const end = parseAcademicCalendarDate(event.endDate ?? event.startDate);
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
    const identity = createAcademicCalendarMonthIdentity(cursor);
    periods.push({
      key: identity.key,
      label: identity.label,
      startDate: identity.startDate,
      endDate: identity.endDate,
    });
    const year = cursor.getUTCFullYear();
    const monthIndex = cursor.getUTCMonth();
    cursor = new Date(Date.UTC(year, monthIndex + 1, 1));
  }

  return periods;
}
function getWeeksInRange(start: Date, end: Date): Array<Omit<AcademicCalendarPeriod<never>, "events">> {
  const periods: Array<Omit<AcademicCalendarPeriod<never>, "events">> = [];
  let cursor = startOfAcademicCalendarMondayWeek(start);

  while (cursor <= end) {
    const identity = createAcademicCalendarWeekIdentity(cursor);
    periods.push({
      key: identity.key,
      label: identity.label,
      startDate: identity.startDate,
      endDate: identity.endDate,
    });
    cursor = addAcademicCalendarDays(cursor, 7);
  }

  return periods;
}
