import { describe, expect, it } from "vitest";

import { academicCalendarSaveSchema } from "./academic-calendar-save";

const validEvent = {
  academicYear: 2027,
  title: "1학기 중간고사",
  type: "written_exam" as const,
  semester: 1 as const,
  startDate: "2027-04-26",
  endDate: "2027-04-28",
  targetGrades: [2, 3] as Array<2 | 3>,
  writtenExamKind: "midterm" as const,
  sourceText: "4월 26일~28일 2, 3학년 중간고사",
  issues: [],
};

describe("academicCalendarSaveSchema", () => {
  it("accepts reviewed events for the selected academic year", () => {
    expect(academicCalendarSaveSchema.safeParse({ academicYear: 2027, events: [validEvent] }).success).toBe(true);
  });

  it("rejects an event from a different academic year", () => {
    const result = academicCalendarSaveSchema.safeParse({
      academicYear: 2027,
      events: [{ ...validEvent, academicYear: 2026 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    const result = academicCalendarSaveSchema.safeParse({
      academicYear: 2027,
      events: [{ ...validEvent, startDate: "2027-02-30" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a written exam until its grade and exam kind are reviewed", () => {
    const result = academicCalendarSaveSchema.safeParse({
      academicYear: 2027,
      events: [{ ...validEvent, targetGrades: [], writtenExamKind: undefined }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects dates outside the selected academic year", () => {
    const result = academicCalendarSaveSchema.safeParse({
      academicYear: 2027,
      events: [{ ...validEvent, startDate: "2027-02-28" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate reviewed events", () => {
    const result = academicCalendarSaveSchema.safeParse({
      academicYear: 2027,
      events: [validEvent, validEvent],
    });

    expect(result.success).toBe(false);
  });
});
