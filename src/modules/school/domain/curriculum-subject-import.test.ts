import { describe, expect, it } from "vitest";

import {
  assessCurriculumSubjectImport,
  curriculumSubjectImportResultSchema,
} from "./curriculum-subject-import";

describe("curriculum subject import assessment", () => {
  it("requires review for a current title that covers one incoming cohort over three years", () => {
    const result = curriculumSubjectImportResultSchema.parse({
      tableTitle: "2026학년도 당해연도 3개년 교육과정 편성표",
      statedAcademicYear: 2026,
      gradeApplicationYears: [
        { grade: 1, academicYear: 2026, evidence: "1학년 (2026년 적용)" },
        { grade: 2, academicYear: 2027, evidence: "2학년 (2027년 적용)" },
        { grade: 3, academicYear: 2028, evidence: "3학년 (2028년 적용)" },
      ],
      coverage: "single_cohort_three_years",
      evidence: ["한 학년 기수가 3년간 진급하는 표"],
      subjects: [
        { name: "사회", grade: null, kind: "course_group" },
        { name: "역사", grade: null, kind: "course" },
        { name: "기술·가정 II", grade: 2, kind: "course" },
        { name: "교과(군) 합계", grade: null, kind: "subtotal" },
        { name: "자유학기 활동", grade: null, kind: "free_semester_activity" },
      ],
    });

    const assessment = assessCurriculumSubjectImport(result, 2026);

    expect(assessment.status).toBe("incoming_cohort");
    expect(assessment.message).toContain("현재 작성 학년도의 교육과정 편성표");
    expect(assessment.candidates.map(({ name }) => name)).toEqual(["역사", "기술·가정 II"]);
  });

  it("allows review of candidates only when all grades explicitly apply in the target year", () => {
    const result = curriculumSubjectImportResultSchema.parse({
      tableTitle: "2026학년도 교육과정 편성표",
      statedAcademicYear: 2026,
      gradeApplicationYears: [1, 2, 3].map((grade) => ({
        grade,
        academicYear: 2026,
        evidence: `${grade}학년 2026년 적용`,
      })),
      coverage: "all_grades",
      evidence: ["전 학년 편성표"],
      subjects: [{ name: "선택 과목 1", grade: 2, kind: "course" }],
    });

    expect(assessCurriculumSubjectImport(result, 2026).status).toBe("current_all_grades");
  });

  it("does not approve a table when its applicability evidence is missing", () => {
    const result = curriculumSubjectImportResultSchema.parse({
      tableTitle: "교육과정 편성표",
      statedAcademicYear: null,
      gradeApplicationYears: [],
      coverage: "unclear",
      evidence: [],
      subjects: [{ name: "수학", grade: null, kind: "course" }],
    });

    expect(assessCurriculumSubjectImport(result, 2026).status).toBe("review_required");
  });

  it("requires the stated table year as well as all-grade application years", () => {
    const result = curriculumSubjectImportResultSchema.parse({
      tableTitle: null,
      statedAcademicYear: null,
      gradeApplicationYears: [1, 2, 3].map((grade) => ({
        grade,
        academicYear: 2026,
        evidence: `${grade}학년 2026년 적용`,
      })),
      coverage: "all_grades",
      evidence: ["전 학년 적용 연도는 같지만 표의 기준 학년도는 확인되지 않음"],
      subjects: [{ name: "수학", grade: null, kind: "course" }],
    });

    expect(assessCurriculumSubjectImport(result, 2026).status).toBe("review_required");
  });

  it("rejects AI output with fields outside the limited schema", () => {
    expect(curriculumSubjectImportResultSchema.safeParse({
      tableTitle: null,
      statedAcademicYear: 2026,
      gradeApplicationYears: [],
      coverage: "unclear",
      evidence: [],
      subjects: [],
      html: "<script />",
    }).success).toBe(false);
  });
});
