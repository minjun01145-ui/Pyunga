import { describe, expect, it } from "vitest";

import {
  createAcademicCalendarMonthIdentity,
  createAcademicCalendarWeekIdentity,
  parseAcademicCalendarDate,
} from "./academic-calendar-date";

describe("academic calendar period identity", () => {
  it("creates a canonical month identity", () => {
    expect(createAcademicCalendarMonthIdentity(parseAcademicCalendarDate("2026-09-15"))).toEqual({
      key: "2026-09",
      label: "9월",
      month: 9,
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });
  });

  it("assigns a cross-month week to the month containing Thursday", () => {
    expect(createAcademicCalendarWeekIdentity(parseAcademicCalendarDate("2026-09-28"))).toEqual({
      key: "2026-10-w1",
      label: "10월 1주",
      month: 10,
      week: 1,
      startDate: "2026-09-28",
      endDate: "2026-10-04",
    });
  });
});
