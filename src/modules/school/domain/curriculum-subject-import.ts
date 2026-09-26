import { z } from "zod";

const academicYearSchema = z.number().int().min(2000).max(2100);

export const curriculumSubjectImportResultSchema = z.object({
  tableTitle: z.string().trim().max(200).nullable(),
  statedAcademicYear: academicYearSchema.nullable(),
  gradeApplicationYears: z.array(z.object({
    grade: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    academicYear: academicYearSchema,
    evidence: z.string().trim().min(1).max(200),
  }).strict()).max(9),
  coverage: z.enum(["all_grades", "single_cohort_three_years", "unclear"]),
  evidence: z.array(z.string().trim().min(1).max(240)).max(8),
  subjects: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    grade: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
    kind: z.enum(["course", "course_group", "subtotal", "creative_experience", "free_semester_activity"]),
  }).strict()).max(100),
}).strict();

export type CurriculumSubjectImportResult = z.infer<typeof curriculumSubjectImportResultSchema>;
export type CurriculumSubjectImportCandidate = {
  name: string;
  grade: 1 | 2 | 3 | null;
  kind: "course";
};

export type CurriculumSubjectImportAssessment = {
  tableTitle: string | null;
  targetAcademicYear: number;
  statedAcademicYear: number | null;
  gradeApplicationYears: CurriculumSubjectImportResult["gradeApplicationYears"];
  coverage: CurriculumSubjectImportResult["coverage"];
  evidence: string[];
  status: "current_all_grades" | "incoming_cohort" | "other_academic_year" | "review_required";
  message: string;
  candidates: CurriculumSubjectImportCandidate[];
};

export function assessCurriculumSubjectImport(
  result: CurriculumSubjectImportResult,
  targetAcademicYear: number,
): CurriculumSubjectImportAssessment {
  const subjects = deduplicateSubjects(result.subjects);
  const currentGradeYears = new Map<number, Set<number>>();
  for (const item of result.gradeApplicationYears) {
    const years = currentGradeYears.get(item.grade) ?? new Set<number>();
    years.add(item.academicYear);
    currentGradeYears.set(item.grade, years);
  }

  const yearsByGrade = [1, 2, 3].map((grade) => currentGradeYears.get(grade) ?? new Set<number>());
  const allGradesCurrent = yearsByGrade.every((years) => years.size === 1 && years.has(targetAcademicYear));
  const incomingCohort = result.coverage === "single_cohort_three_years"
    && [0, 1, 2].every((offset) => {
      const years = currentGradeYears.get(offset + 1);
      return years?.size === 1 && years.has(targetAcademicYear + offset);
    });
  const statedYearMatches = result.statedAcademicYear === targetAcademicYear;

  if (allGradesCurrent && result.coverage === "all_grades" && statedYearMatches) {
    return {
      ...result,
      targetAcademicYear,
      status: "current_all_grades",
      message: `${targetAcademicYear}학년도 전체 학년 편성 근거를 확인했습니다. 과목 후보를 검토한 뒤 확정해 주세요.`,
      candidates: subjects,
    };
  }
  if (incomingCohort) {
    return {
      ...result,
      targetAcademicYear,
      status: "incoming_cohort",
      message: "현재 작성 학년도의 전체 학년 편성표가 아닙니다. 현재 작성 학년도의 교육과정 편성표를 올려 주세요.",
      candidates: subjects,
    };
  }
  if (result.statedAcademicYear !== null && result.statedAcademicYear !== targetAcademicYear) {
    return {
      ...result,
      targetAcademicYear,
      status: "other_academic_year",
      message: "자료의 학년도가 현재 작성 학년도와 다릅니다. 현재 작성 학년도의 교육과정 편성표를 올려 주세요.",
      candidates: subjects,
    };
  }
  return {
    ...result,
    targetAcademicYear,
    status: "review_required",
    message: "학년도 또는 학년별 적용 범위를 확인할 수 없습니다. 근거가 확인되는 교육과정 편성표를 다시 올려 주세요.",
    candidates: subjects,
  };
}

function deduplicateSubjects(subjects: readonly CurriculumSubjectImportResult["subjects"][number][]): CurriculumSubjectImportCandidate[] {
  const unique = new Map<string, CurriculumSubjectImportCandidate>();
  for (const subject of subjects) {
    if (subject.kind !== "course") continue;
    const name = subject.name.normalize("NFKC").trim().replace(/\s+/g, " ");
    const key = name.toLocaleLowerCase("ko-KR");
    if (name && !unique.has(key)) unique.set(key, { name, grade: subject.grade, kind: "course" });
  }
  return [...unique.values()];
}
