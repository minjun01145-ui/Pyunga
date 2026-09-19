import type {
  AcademicCalendarEvent,
  AcademicSemester,
  SchoolGrade,
} from "./academic-calendar-event";
import type { AcademicCalendarPeriodUnit } from "./academic-calendar-period";

export type AcademicCalendarTeachingPeriod = {
  key: string;
  label: string;
  month: number;
  week?: number;
  startDate: string;
  endDate: string;
  events: AcademicCalendarEvent[];
};

export type AcademicCalendarSemesterRange = {
  startDate: string;
  endDate: string;
};

export function resolveAcademicCalendarSemesterRange(
  events: readonly AcademicCalendarEvent[],
  semester: AcademicSemester,
): AcademicCalendarSemesterRange | undefined {
  const semesterEvents = events
    .filter((event) => event.semester === semester)
    .slice()
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
  if (semesterEvents.length === 0) return undefined;

  const nonVacationEvents = semesterEvents.filter((event) => event.type !== "vacation");
  const rangeEvents = nonVacationEvents.length > 0 ? nonVacationEvents : semesterEvents;
  const startDate = rangeEvents[0].startDate;
  const latestNonVacationEnd = rangeEvents.reduce((latest, event) => {
    const eventEnd = event.endDate ?? event.startDate;
    return eventEnd > latest ? eventEnd : latest;
  }, rangeEvents[0].endDate ?? rangeEvents[0].startDate);
  const firstVacation = semesterEvents.find(
    (event) => event.type === "vacation" && event.startDate > startDate,
  );
  const hasSchoolEventAfterVacation = firstVacation
    ? nonVacationEvents.some(
        (event) => event.startDate > (firstVacation.endDate ?? firstVacation.startDate),
      )
    : false;
  const endDate = firstVacation && !hasSchoolEventAfterVacation
    ? formatDate(addDays(parseDate(firstVacation.startDate), -1))
    : latestNonVacationEnd;

  return { startDate, endDate };
}

export function buildAcademicCalendarTeachingPeriods(
  events: readonly AcademicCalendarEvent[],
  options: {
    semester: AcademicSemester;
    grade: SchoolGrade;
    unit: AcademicCalendarPeriodUnit;
    range: AcademicCalendarSemesterRange;
  },
): AcademicCalendarTeachingPeriod[] {
  const relevantEvents = events
    .filter((event) => event.semester === options.semester)
    .filter((event) => event.targetGrades === undefined
      || event.targetGrades.length === 0
      || event.targetGrades.includes(options.grade))
    .slice()
    .sort((left, right) => left.startDate.localeCompare(right.startDate));

  return options.unit === "month"
    ? buildMonthPeriods(options.range.startDate, options.range.endDate, relevantEvents)
    : buildWeekPeriods(options.range.startDate, options.range.endDate, relevantEvents);
}

export function formatAcademicCalendarPeriodDateRange(period: Pick<AcademicCalendarTeachingPeriod, "startDate" | "endDate">): string {
  const start = formatMonthDay(period.startDate);
  const end = formatMonthDay(period.endDate);
  return start === end ? start : `${start}~${end}`;
}

export function formatAcademicCalendarPeriodEvents(
  period: Pick<AcademicCalendarTeachingPeriod, "events">,
): string {
  return period.events
    .map((event) => `${formatEventDate(event)} ${event.title}`)
    .join("\n");
}

function buildMonthPeriods(
  startDate: string,
  endDate: string,
  events: readonly AcademicCalendarEvent[],
): AcademicCalendarTeachingPeriod[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const finalMonth = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1);
  const periods: AcademicCalendarTeachingPeriod[] = [];

  while (cursor.getTime() <= finalMonth) {
    const year = cursor.getUTCFullYear();
    const monthIndex = cursor.getUTCMonth();
    const month = monthIndex + 1;
    const periodStart = formatDate(cursor);
    const periodEnd = formatDate(new Date(Date.UTC(year, monthIndex + 1, 0)));
    if (!isEntirelyVacation(events, periodStart, periodEnd)) {
      periods.push({
        key: `${year}-${pad(month)}`,
        label: `${month}월`,
        month,
        startDate: periodStart,
        endDate: periodEnd,
        events: events.filter((event) => overlaps(event, periodStart, periodEnd)),
      });
    }
    cursor = new Date(Date.UTC(year, monthIndex + 1, 1));
  }
  return periods;
}

function buildWeekPeriods(
  startDate: string,
  endDate: string,
  events: readonly AcademicCalendarEvent[],
): AcademicCalendarTeachingPeriod[] {
  const end = parseDate(endDate);
  let cursor = startOfMondayWeek(parseDate(startDate));
  const periods: AcademicCalendarTeachingPeriod[] = [];

  while (cursor <= end) {
    const thursday = addDays(cursor, 3);
    const month = thursday.getUTCMonth() + 1;
    const week = Math.ceil(thursday.getUTCDate() / 7);
    const periodStart = formatDate(cursor);
    const periodEnd = formatDate(addDays(cursor, 6));
    if (!isEntirelyVacation(events, periodStart, periodEnd)) {
      periods.push({
        key: `${thursday.getUTCFullYear()}-${pad(month)}-w${week}`,
        label: `${month}월 ${week}주`,
        month,
        week,
        startDate: periodStart,
        endDate: periodEnd,
        events: events.filter((event) => overlaps(event, periodStart, periodEnd)),
      });
    }
    cursor = addDays(cursor, 7);
  }
  return periods;
}

function overlaps(event: AcademicCalendarEvent, startDate: string, endDate: string): boolean {
  const eventEnd = event.endDate ?? event.startDate;
  return event.startDate <= endDate && eventEnd >= startDate;
}

function isEntirelyVacation(
  events: readonly AcademicCalendarEvent[],
  startDate: string,
  endDate: string,
): boolean {
  return events.some((event) =>
    event.type === "vacation"
    && event.startDate <= startDate
    && (event.endDate ?? event.startDate) >= endDate,
  );
}


function formatEventDate(event: Pick<AcademicCalendarEvent, "startDate" | "endDate">): string {
  const start = formatMonthDay(event.startDate);
  const end = event.endDate ? formatMonthDay(event.endDate) : start;
  return start === end ? start : `${start}~${end}`;
}

function formatMonthDay(value: string): string {
  const [, month, day] = value.split("-").map(Number);
  return `${month}/${day}`;
}

function startOfMondayWeek(date: Date): Date {
  const day = date.getUTCDay();
  return addDays(date, -(day === 0 ? 6 : day - 1));
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
