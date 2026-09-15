import type { PerformanceAssessment } from "@/modules/performance-assessment";

export const EVALUATION_PLAN_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
] as const;

export type EvaluationPlanStatus = (typeof EVALUATION_PLAN_STATUSES)[number];

export type WrittenAssessment = {
  id: string;
  title: string;
  weightPercent: number;
};

export type EvaluationPlan = {
  id: string;
  schoolId: string;
  academicYear: number;
  semester: 1 | 2;
  grade: 1 | 2 | 3;
  subjectId: string;
  teacherUserId: string;
  status: EvaluationPlanStatus;
  writtenAssessments: WrittenAssessment[];
  performanceAssessments: PerformanceAssessment[];
};
