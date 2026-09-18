import {
  buildAcademicCalendarTeachingPeriods,
  formatAcademicCalendarPeriodDateRange,
  formatAcademicCalendarPeriodEvents,
  resolveAcademicCalendarSemesterRange,
  type AcademicCalendarEvent,
  type AcademicCalendarTeachingPeriod,
} from "@/modules/academic-calendar";
import type {
  TableTemplateSystemValue,
  TeachingLearningTableConfig,
} from "@/modules/template";

import type { TeacherEvaluationContext } from "./teacher-evaluation-context";

export type TeachingLearningCalendarRow = {
  key: string;
  period: AcademicCalendarTeachingPeriod;
};

export function buildTeachingLearningCalendarRows(
  config: TeachingLearningTableConfig,
  events: readonly AcademicCalendarEvent[],
  context: TeacherEvaluationContext,
): TeachingLearningCalendarRow[] {
  if (!config.calendarRows.enabled) return [];
  const range = resolveAcademicCalendarSemesterRange(events, context.semester);
  if (!range) return [];
  return buildAcademicCalendarTeachingPeriods(events, {
    semester: context.semester,
    grade: context.grade,
    unit: config.calendarRows.periodUnit,
    range,
  }).map((period) => ({ key: period.key, period }));
}

export function resolveAcademicCalendarSystemValue(
  systemValue: TableTemplateSystemValue | undefined,
  row: TeachingLearningCalendarRow,
): string {
  switch (systemValue ?? "academic_calendar.period") {
    case "academic_calendar.month":
      return String(row.period.month);
    case "academic_calendar.week":
      return row.period.week === undefined ? "" : String(row.period.week);
    case "academic_calendar.date_range":
      return formatAcademicCalendarPeriodDateRange(row.period);
    case "academic_calendar.events":
      return formatAcademicCalendarPeriodEvents(row.period);
    case "academic_calendar.period":
      return row.period.label;
  }
}
