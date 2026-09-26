import type {
  AcademicSemester,
  SchoolGrade,
} from "@/modules/academic-calendar";
import { EVALUATION_DEMO_CONTEXT } from "@/shared/demo/evaluation-demo-context";
import type { UserProfile } from "@/modules/auth";
import type { EvaluationAcademicPeriod } from "@/modules/template";

export type TeacherEvaluationContext = {
  academicYear: number;
  semester: AcademicSemester;
  grade: SchoolGrade;
  subjectId?: string;
  subjectLabel: string;
};

export const DEMO_TEACHER_EVALUATION_CONTEXT: TeacherEvaluationContext = EVALUATION_DEMO_CONTEXT;

export class TeacherEvaluationContextUnavailableError extends Error {
  constructor() {
    super("평가계에서 작성 학년도·학기와 교사의 담당 교과·학년을 설정해 주세요.");
    this.name = "TeacherEvaluationContextUnavailableError";
  }
}

export function resolveTeacherEvaluationContext(params: {
  demoMode: boolean;
  profile?: UserProfile;
  academicPeriod?: EvaluationAcademicPeriod;
  grade?: number;
}): TeacherEvaluationContext {
  if (params.demoMode) return { ...DEMO_TEACHER_EVALUATION_CONTEXT, ...params.academicPeriod };
  const { profile, academicPeriod } = params;
  const grade = params.grade ?? profile?.teachingGrades[0];
  if (profile?.subjectLabel && academicPeriod && (grade === 1 || grade === 2 || grade === 3)
      && profile.teachingGrades.includes(grade)) {
    return { ...academicPeriod, grade, subjectId: profile.subjectId, subjectLabel: profile.subjectLabel };
  }
  throw new TeacherEvaluationContextUnavailableError();
}
