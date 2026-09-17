import { describe, expect, it } from "vitest";

import type { AiJsonClient, AiJsonRequest } from "../../ai-review";
import {
  importAcademicCalendarFromText,
  selectAcademicCalendarSourceText,
} from "./academic-calendar-import";

describe("academic calendar import", () => {
  it("keeps calendar pages that are identified by timetable headers and activities", () => {
    const selection = selectAcademicCalendarSourceText([
      { pageNumber: 1, text: "학교 교육 목표" },
      { pageNumber: 2, text: "2026학년도 학사일정 운영 계획" },
      { pageNumber: 3, text: "월 주 월 화 수 목 금 수업일수 주요교육활동 학급회 동아리" },
      { pageNumber: 4, text: "예산 운영 계획" },
      { pageNumber: 5, text: "교직원 연수" },
    ]);

    expect(selection.pageNumbers).toEqual([1, 2, 3, 4]);
    expect(selection.text).toContain("주요교육활동 학급회 동아리");
    expect(selection.text).not.toContain("교직원 연수");
  });

  it("keeps small and recurring school activities instead of filtering them out", async () => {
    let request: AiJsonRequest | undefined;
    const aiClient: AiJsonClient = {
      async generateJson(receivedRequest) {
        request = receivedRequest;
        return {
          documentTitle: "2026학년 학사일정 운영 계획(안)",
          events: [
            {
              title: "중간고사(2,3년)",
              type: "written_exam",
              semester: 1,
              startDate: "2026-04-29",
              endDate: "2026-04-30",
              targetGrades: [3, 2, 2],
              writtenExamKind: "midterm",
              sourceText: "29일(수), 중간고사(2,3년) 30일(목), 중간고사(2,3년)",
            },
            {
              title: "학급회",
              type: "school_event",
              semester: 1,
              startDate: "2026-04-16",
              endDate: null,
              targetGrades: [],
              writtenExamKind: null,
              sourceText: "16일(목), 학급회(7h)",
            },
            {
              title: "동아리 활동",
              type: "school_event",
              semester: 1,
              startDate: "2026-04-10",
              endDate: null,
              targetGrades: [],
              writtenExamKind: null,
              sourceText: "10일(금), 동아리 활동 - 수업(4), 동(2)",
            },
            {
              title: "학교폭력예방교육",
              type: "school_event",
              semester: 1,
              startDate: "2026-03-04",
              endDate: null,
              targetGrades: [],
              writtenExamKind: null,
              sourceText: "4일(수), 학교폭력예방교육(6h)",
            },
          ],
          warnings: [],
        };
      },
    };

    const result = await importAcademicCalendarFromText({
      academicYear: 2026,
      sourceText:
        "2026학년도 1학기 학사일정 중간고사 2,3학년 4월 29일과 30일, 학급회, 동아리 활동, 학교폭력예방교육",
      aiClient,
    });

    expect(result.events.map((event) => event.title)).toEqual([
      "학교폭력예방교육",
      "동아리 활동",
      "학급회",
      "중간고사(2,3년)",
    ]);
    expect(request?.messages[0]?.content).toContain("중요도를 판단해서 일정을 생략하지 마세요");
    expect(request?.messages[0]?.content).toContain("학급회, 동아리");
  });

  it("deduplicates duplicate source mentions while preserving repeated events on different dates", async () => {
    const aiClient: AiJsonClient = {
      async generateJson() {
        return {
          documentTitle: "2026학년 학사일정 운영 계획(안)",
          events: [
            {
              title: "학급회",
              type: "school_event",
              semester: 1,
              startDate: "2026-04-16",
              endDate: null,
              targetGrades: [],
              writtenExamKind: null,
              sourceText: "16일(목), 학급회(7h)",
            },
            {
              title: "학급회",
              type: "school_event",
              semester: 1,
              startDate: "2026-04-16",
              endDate: null,
              targetGrades: [],
              writtenExamKind: null,
              sourceText: "학급회(7h)",
            },
            {
              title: "학급회",
              type: "school_event",
              semester: 1,
              startDate: "2026-05-21",
              endDate: null,
              targetGrades: [],
              writtenExamKind: null,
              sourceText: "21일(목), 학급회",
            },
          ],
          warnings: [],
        };
      },
    };

    const result = await importAcademicCalendarFromText({
      academicYear: 2026,
      sourceText: "2026학년도 학사일정 4월 16일 학급회, 5월 21일 학급회",
      aiClient,
    });

    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.startDate)).toEqual(["2026-04-16", "2026-05-21"]);
  });
});
