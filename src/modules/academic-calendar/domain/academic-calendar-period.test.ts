import { describe, expect, it } from "vitest";

import { groupAcademicCalendarEventsByPeriod } from "./academic-calendar-period";

const events = [
  { title: "개학식", startDate: "2026-09-01" },
  { title: "정기고사", startDate: "2026-09-30", endDate: "2026-10-02" },
];

describe("groupAcademicCalendarEventsByPeriod", () => {
  it("groups events by month and includes a cross-month event in both months", () => {
    const periods = groupAcademicCalendarEventsByPeriod(events, "month");

    expect(periods.map((period) => period.label)).toEqual(["9월", "10월"]);
    expect(periods[0].events.map((event) => event.title)).toEqual(["개학식", "정기고사"]);
    expect(periods[1].events.map((event) => event.title)).toEqual(["정기고사"]);
  });

  it("uses Monday-to-Sunday weeks and names the week by its Thursday", () => {
    const periods = groupAcademicCalendarEventsByPeriod(events, "month_week");

    expect(periods.map((period) => ({ label: period.label, startDate: period.startDate, endDate: period.endDate }))).toEqual([
      { label: "9월 1주", startDate: "2026-08-31", endDate: "2026-09-06" },
      { label: "10월 1주", startDate: "2026-09-28", endDate: "2026-10-04" },
    ]);
    expect(periods[1].events).toHaveLength(1);
  });

  it("ignores invalid draft dates", () => {
    expect(groupAcademicCalendarEventsByPeriod([{ startDate: "" }], "month_week")).toEqual([]);
  });
});
