import { describe, expect, it } from "vitest";

import type { AcademicCalendarEvent } from "./academic-calendar-event";
import {
  buildAcademicCalendarTeachingPeriods,
  formatAcademicCalendarPeriodEvents,
  resolveAcademicCalendarSemesterRange,
} from "./academic-calendar-teaching-period";

const events: AcademicCalendarEvent[] = [
  {
    id: "opening",
    schoolId: "school",
    academicYear: 2026,
    title: "입학식, 1학기 개학일",
    type: "school_event",
    semester: 1,
    startDate: "2026-03-03",
    targetGrades: [1, 2, 3],
  },
  {
    id: "exam",
    schoolId: "school",
    academicYear: 2026,
    title: "중간고사(1,2,3)",
    type: "written_exam",
    semester: 1,
    startDate: "2026-04-27",
    endDate: "2026-05-01",
    targetGrades: [1, 2, 3],
    writtenExamKind: "midterm",
  },
];

describe("academic calendar teaching periods", () => {
  it("creates continuous monthly rows across the selected semester event range", () => {
    const range = resolveAcademicCalendarSemesterRange(events, 1);
    if (!range) throw new Error("semester range expected");
    const periods = buildAcademicCalendarTeachingPeriods(events, { semester: 1, grade: 3, unit: "month", range });
    expect(periods.map((period) => period.label)).toEqual(["3월", "4월", "5월"]);
    expect(periods[1].events.map((event) => event.title)).toEqual(["중간고사(1,2,3)"]);
  });

  it("creates continuous Monday-to-Sunday week rows, including weeks without events", () => {
    const range = resolveAcademicCalendarSemesterRange(events, 1);
    if (!range) throw new Error("semester range expected");
    const periods = buildAcademicCalendarTeachingPeriods(events, { semester: 1, grade: 3, unit: "month_week", range });
    expect(periods[0]).toMatchObject({
      label: "3월 1주",
      startDate: "2026-03-02",
      endDate: "2026-03-08",
    });
    expect(periods.some((period) => period.events.length === 0)).toBe(true);
    expect(formatAcademicCalendarPeriodEvents(periods[0])).toBe("3/3 입학식, 1학기 개학일");
  });

  it("filters grade-specific events while retaining school-wide events", () => {
    const calendar: AcademicCalendarEvent[] = [
      ...events,
      {
        id: "grade-2",
        schoolId: "school",
        academicYear: 2026,
        title: "2학년 행사",
        type: "school_event",
        semester: 1,
        startDate: "2026-03-10",
        targetGrades: [2],
      },
    ];
    const range = resolveAcademicCalendarSemesterRange(calendar, 1);
    if (!range) throw new Error("semester range expected");
    const periods = buildAcademicCalendarTeachingPeriods(calendar, { semester: 1, grade: 3, unit: "month_week", range });

    expect(periods.flatMap((period) => period.events).some((event) => event.title === "2학년 행사")).toBe(false);
  });

  it("extends through the pre-vacation teaching range even when the selected grade has no late event", () => {
    const calendar: AcademicCalendarEvent[] = [
      events[0],
      {
        id: "grade-2-only",
        schoolId: "school",
        academicYear: 2026,
        title: "2학년 행사",
        type: "school_event",
        semester: 1,
        startDate: "2026-06-10",
        targetGrades: [2],
      },
      {
        id: "summer",
        schoolId: "school",
        academicYear: 2026,
        title: "여름방학",
        type: "vacation",
        semester: 1,
        startDate: "2026-07-20",
        targetGrades: [],
      },
    ];
    const range = resolveAcademicCalendarSemesterRange(calendar, 1);
    expect(range).toEqual({ startDate: "2026-03-03", endDate: "2026-07-19" });
    if (!range) throw new Error("semester range expected");
    const periods = buildAcademicCalendarTeachingPeriods(calendar, { semester: 1, grade: 3, unit: "month_week", range });
    expect(periods.at(-1)?.endDate).toBe("2026-07-19");
  });

  it("skips vacation-only weeks but keeps post-vacation school weeks in the same semester", () => {
    const calendar: AcademicCalendarEvent[] = [
      {
        id: "semester-start",
        schoolId: "school",
        academicYear: 2026,
        title: "2학기 개학",
        type: "school_event",
        semester: 2,
        startDate: "2026-08-18",
        targetGrades: [],
      },
      {
        id: "winter",
        schoolId: "school",
        academicYear: 2026,
        title: "겨울방학",
        type: "vacation",
        semester: 2,
        startDate: "2026-12-31",
        endDate: "2027-01-28",
        targetGrades: [],
      },
      {
        id: "reopen",
        schoolId: "school",
        academicYear: 2026,
        title: "개학일",
        type: "school_event",
        semester: 2,
        startDate: "2027-01-29",
        targetGrades: [],
      },
      {
        id: "graduation",
        schoolId: "school",
        academicYear: 2026,
        title: "졸업식",
        type: "school_event",
        semester: 2,
        startDate: "2027-02-03",
        targetGrades: [3],
      },
    ];
    const range = resolveAcademicCalendarSemesterRange(calendar, 2);
    expect(range).toEqual({ startDate: "2026-08-18", endDate: "2027-02-03" });
    if (!range) throw new Error("semester range expected");
    const periods = buildAcademicCalendarTeachingPeriods(calendar, { semester: 2, grade: 3, unit: "month_week", range });

    expect(periods.some((period) => period.startDate === "2027-01-04")).toBe(false);
    expect(periods.some((period) => period.startDate === "2027-01-25" && period.endDate === "2027-01-31")).toBe(true);
    expect(periods.at(-1)?.endDate).toBe("2027-02-07");
  });
});
