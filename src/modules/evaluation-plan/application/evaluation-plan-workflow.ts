import { z } from "zod";
import { canManageEvaluationPlans, type UserProfile } from "@/modules/auth";
import type { AcademicCalendarEvent } from "@/modules/academic-calendar";
import type { EvaluationTemplate } from "@/modules/template";
import { EVALUATION_PLAN_STATUSES, type EvaluationPlanStatus } from "../domain/evaluation-plan";
import { evaluationPlanDraftSchema, getEvaluationPlanDraftTemplateIssues, type EvaluationPlanDraft } from "./evaluation-plan-draft";
import type { TeacherEvaluationContext } from "./teacher-evaluation-context";
import { validateAssessmentWeights } from "../domain/validation";
import { normalizeSubjectName, type SchoolSubject } from "@/modules/school";

export const EVALUATION_PLAN_STATUS_LABELS: Record<EvaluationPlanStatus, string> = {
  draft: "작성 중", submitted: "제출됨", rejected: "반려됨", approved: "승인됨",
};

export const evaluationPlanWriteSchema = z.object({
  draft: evaluationPlanDraftSchema,
  expectedRevision: z.number().int().min(0),
  expectedTemplateRevision: z.number().int().min(0),
  existingPlanId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  action: z.enum(["save", "submit"]),
}).strict();

export const evaluationPlanReviewSchema = z.object({
  expectedRevision: z.number().int().min(1),
  action: z.enum(["approve", "reject"]),
  comment: z.string().trim().max(2000),
}).strict().refine((value) => value.action !== "reject" || value.comment.length > 0, "반려 사유를 입력해 주세요.");

export const evaluationPlanSummarySchema = z.object({
  id: z.string().min(1),
  teacherUserId: z.string().min(1),
  teacherLabel: z.string(),
  context: z.object({ academicYear: z.number().int(), semester: z.union([z.literal(1), z.literal(2)]), grade: z.union([z.literal(1), z.literal(2), z.literal(3)]), subjectId: z.string().optional(), subjectLabel: z.string() }),
  status: z.enum(EVALUATION_PLAN_STATUSES),
  revision: z.number().int().min(1),
  templateSignature: z.string(),
  updatedAt: z.string(),
  reviewComment: z.string(),
});

export type EvaluationPlanSummary = z.infer<typeof evaluationPlanSummarySchema>;

export function filterPlansForActiveSubjects<T extends Pick<EvaluationPlanSummary, "context">>(
  plans: readonly T[],
  subjects: readonly SchoolSubject[],
): T[] {
  const activeSubjects = subjects.filter((subject) => subject.activeForPlans);
  const activeIds = new Set(activeSubjects.map((subject) => subject.id));
  const activeLabels = new Set(activeSubjects.flatMap((subject) => [subject.name, ...subject.legacyNames])
    .map((name) => normalizeSubjectName(name).toLocaleLowerCase("ko-KR")));
  return plans.filter((plan) => plan.context.subjectId
    ? activeIds.has(plan.context.subjectId)
    : activeLabels.has(normalizeSubjectName(plan.context.subjectLabel).toLocaleLowerCase("ko-KR")));
}

export type SavedEvaluationPlan = EvaluationPlanSummary & {
  draft: EvaluationPlanDraft;
  template: EvaluationTemplate;
  calendarEvents: AcademicCalendarEvent[];
};

export type EvaluationPlanWorkspaceData = {
  template: EvaluationTemplate | null;
  templateRevision: number;
  teacherContext: TeacherEvaluationContext;
  calendarEvents: AcademicCalendarEvent[];
  savedPlan: SavedEvaluationPlan | null;
  teachingGrades: number[];
  persistence: "browser" | "server";
  draftStorageScope?: string | null;
  previewMode?: boolean;
  readOnly?: boolean;
  error?: string;
};

export type EvaluationPlanWorkspaceResponse = EvaluationPlanWorkspaceData | {
  previewSelectionRequired: true;
  previewSubjects: Array<{ id: string; name: string }>;
  template: EvaluationTemplate | null;
  templateRevision: number;
  error?: string;
};

export class EvaluationPlanWorkflowError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404 | 409 = 409) {
    super(message);
    this.name = "EvaluationPlanWorkflowError";
  }
}

export function transitionEvaluationPlan(params: {
  profile: UserProfile;
  teacherUserId: string;
  status: EvaluationPlanStatus;
  action: "save" | "submit" | "approve" | "reject";
}): EvaluationPlanStatus {
  const { profile, teacherUserId, status, action } = params;
  if (action === "save" || action === "submit") {
    if (profile.id !== teacherUserId) throw new EvaluationPlanWorkflowError("본인의 평가계획만 수정할 수 있습니다.", 403);
    if (status !== "draft" && status !== "rejected") throw new EvaluationPlanWorkflowError("제출하거나 승인된 평가계획은 수정할 수 없습니다.");
    return action === "submit" ? "submitted" : "draft";
  }
  if (!canManageEvaluationPlans(profile.role)) throw new EvaluationPlanWorkflowError("평가계 검토 권한이 필요합니다.", 403);
  if (status !== "submitted") throw new EvaluationPlanWorkflowError("제출된 평가계획만 검토할 수 있습니다.");
  return action === "approve" ? "approved" : "rejected";
}

export function getEvaluationPlanSubmissionIssues(
  template: EvaluationTemplate, draft: EvaluationPlanDraft,
  teacherContext: TeacherEvaluationContext, calendarEvents: readonly AcademicCalendarEvent[],
): string[] {
  const issues = getEvaluationPlanDraftTemplateIssues(template, draft, { teacherContext, calendarEvents }).map((issue) => issue.message);
  const hasValue = (value: string | string[]) => Array.isArray(value) ? value.some((item) => item.trim()) : value.trim();
  const hasContent = template.sections.some((section) => {
    const data = draft.sections[section.id];
    if (!data) return false;
    return data.body?.trim() || Object.values(data.fields).some(hasValue)
      || Object.values(data.rows ?? {}).some((row) => Object.values(row.fields).some(hasValue));
  });
  if (!hasContent) issues.push("평가계획 내용을 작성한 뒤 제출해 주세요.");
  const weights: number[] = [];
  for (const section of template.sections) {
    if (section.config?.type !== "written_assessment_table" && section.config?.type !== "performance_assessment_table") continue;
    const fields = draft.sections[section.id]?.fields ?? {};
    if (!Object.values(fields).some(hasValue)) continue;
    const bindings = section.config.table.content[0].content.flatMap((row) => row.content.map((cell) => cell.attrs.fieldKey));
    if (bindings.includes("weightPercent")) {
      if (typeof fields.weightPercent !== "string" || !fields.weightPercent.trim()) issues.push(`${section.title}: 반영 비율을 입력해 주세요.`);
      else weights.push(Number(fields.weightPercent));
    }
    if (bindings.includes("maxScore") && (typeof fields.maxScore !== "string" || !fields.maxScore.trim() || !Number.isFinite(Number(fields.maxScore)) || Number(fields.maxScore) <= 0)) {
      issues.push(`${section.title}: 만점은 0보다 큰 숫자로 입력해 주세요.`);
    }
  }
  if (weights.length) {
    for (const issue of validateAssessmentWeights(weights)) {
      issues.push(issue.code === "TOTAL_WEIGHT_NOT_100" ? `지필·수행평가 반영 비율 합계는 100%여야 합니다. 현재 ${issue.actual}%입니다.` : "반영 비율은 음수일 수 없습니다.");
    }
  }
  return [...new Set(issues)];
}
