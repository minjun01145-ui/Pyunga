import type {
  AcademicSemester,
  SchoolGrade,
} from "@/modules/academic-calendar";
import { EVALUATION_DEMO_CONTEXT } from "@/shared/demo/evaluation-demo-context";

export type TeacherEvaluationContext = {
  academicYear: number;
  semester: AcademicSemester;
  grade: SchoolGrade;
  subjectLabel: string;
};

export const DEMO_TEACHER_EVALUATION_CONTEXT: TeacherEvaluationContext = EVALUATION_DEMO_CONTEXT;

export class TeacherEvaluationContextUnavailableError extends Error {
  constructor() {
    super("로그인 사용자용 평가계획 학년·교과 컨텍스트가 아직 설정되지 않았습니다.");
    this.name = "TeacherEvaluationContextUnavailableError";
  }
}

export function resolveTeacherEvaluationContext(params: {
  demoMode: boolean;
}): TeacherEvaluationContext {
  if (params.demoMode) return DEMO_TEACHER_EVALUATION_CONTEXT;
  throw new TeacherEvaluationContextUnavailableError();
}
