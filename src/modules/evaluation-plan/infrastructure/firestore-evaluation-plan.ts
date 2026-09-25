import { createHash } from "node:crypto";
import { z } from "zod";
import type { UserProfile } from "@/modules/auth";
import { isRealIsoDate, type AcademicCalendarEvent } from "@/modules/academic-calendar";
import { parseEvaluationTemplateSaveInput } from "@/modules/template/server";
import type { EvaluationTemplate } from "@/modules/template";
import { getFirebaseAdminDatabase } from "@/shared/firebase/admin";
import { applyTeacherEvaluationContext, getEvaluationPlanTemplateSignature, parseEvaluationPlanDraft, type EvaluationPlanDraft } from "../application/evaluation-plan-draft";
import { EvaluationPlanWorkflowError, evaluationPlanSummarySchema, getEvaluationPlanSubmissionIssues, transitionEvaluationPlan, type SavedEvaluationPlan } from "../application/evaluation-plan-workflow";
import type { TeacherEvaluationContext } from "../application/teacher-evaluation-context";

const MAX_COMPILED_PLAN_COUNT = 200;
const MAX_COMPILED_PLAN_BYTES = 30 * 1024 * 1024;

const calendarSnapshotSchema = z.array(z.object({
  id: z.string(), schoolId: z.string(), academicYear: z.number().int(), title: z.string(),
  type: z.enum(["written_exam", "school_event", "vacation", "other"]),
  startDate: z.string().refine(isRealIsoDate), endDate: z.string().refine(isRealIsoDate).optional(),
  semester: z.union([z.literal(1), z.literal(2)]).optional(),
  targetGrades: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).optional(),
  writtenExamKind: z.enum(["midterm", "final", "other"]).optional(),
})).max(500);

export function evaluationPlanDocumentId(userId: string, context: TeacherEvaluationContext): string {
  return createHash("sha256").update(JSON.stringify([userId, context.academicYear, context.semester, context.grade, context.subjectLabel])).digest("hex");
}

function collection(schoolId: string) {
  return getFirebaseAdminDatabase().collection("schools").doc(schoolId).collection("evaluationPlans");
}

function parseStoredPlan(value: unknown): SavedEvaluationPlan {
  const summary = evaluationPlanSummarySchema.parse(value);
  const payload = z.object({ draft: z.unknown(), template: z.unknown(), calendarEvents: calendarSnapshotSchema }).parse(value);
  const draft = parseEvaluationPlanDraft(payload.draft);
  const template = parseEvaluationTemplateSaveInput(payload.template);
  if (!draft || !template) throw new Error("Stored evaluation plan is invalid");
  return { ...summary, draft, template, calendarEvents: payload.calendarEvents };
}

export async function loadSavedEvaluationPlan(schoolId: string, id: string): Promise<SavedEvaluationPlan | null> {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new EvaluationPlanWorkflowError("평가계획을 찾을 수 없습니다.", 404);
  const snapshot = await collection(schoolId).doc(id).get();
  return snapshot.exists ? parseStoredPlan(snapshot.data()) : null;
}

export async function listSavedEvaluationPlans(schoolId: string) {
  const snapshot = await getFirebaseAdminDatabase().pipeline().collection(collection(schoolId))
    .select("id", "teacherUserId", "teacherLabel", "context", "status", "revision", "templateSignature", "updatedAt", "reviewComment")
    .limit(1001).execute();
  if (snapshot.results.length > 1000) throw new EvaluationPlanWorkflowError("조회 가능한 평가계획 수를 초과했습니다. 관리자에게 문의해 주세요.", 400);
  return snapshot.results.map((result) => evaluationPlanSummarySchema.parse(result.data()));
}

export async function listApprovedEvaluationPlans(params: {
  schoolId: string;
  academicYear: number;
  semester: 1 | 2;
}): Promise<SavedEvaluationPlan[]> {
  const snapshot = await collection(params.schoolId)
    .where("context.academicYear", "==", params.academicYear)
    .where("context.semester", "==", params.semester)
    .where("status", "==", "approved")
    .limit(MAX_COMPILED_PLAN_COUNT + 1)
    .get();

  if (snapshot.docs.length > MAX_COMPILED_PLAN_COUNT) {
    throw new EvaluationPlanWorkflowError(
      `승인된 평가계획이 ${MAX_COMPILED_PLAN_COUNT}개를 넘어 한 번에 취합할 수 없습니다.`,
      409,
    );
  }

  const plans = snapshot.docs
    .map((document) => parseStoredPlan(document.data()))
    .sort((left, right) => left.context.grade - right.context.grade
      || left.context.subjectLabel.localeCompare(right.context.subjectLabel, "ko")
      || left.teacherLabel.localeCompare(right.teacherLabel, "ko"));

  if (Buffer.byteLength(JSON.stringify(plans), "utf8") > MAX_COMPILED_PLAN_BYTES) {
    throw new EvaluationPlanWorkflowError("취합 자료가 커서 한 번에 출력할 수 없습니다.", 409);
  }

  return plans;
}

export async function writeEvaluationPlan(params: {
  profile: UserProfile; context: TeacherEvaluationContext; draft: EvaluationPlanDraft;
  template: EvaluationTemplate; templateRevision: number; calendarEvents: AcademicCalendarEvent[];
  expectedRevision: number; action: "save" | "submit";
}): Promise<SavedEvaluationPlan> {
  const { profile, context, template, calendarEvents } = params;
  const draft = applyTeacherEvaluationContext(params.draft, context);
  if (params.action === "submit") {
    const issues = getEvaluationPlanSubmissionIssues(template, draft, context, calendarEvents);
    if (issues.length) throw new EvaluationPlanWorkflowError(issues.slice(0, 10).join("\n"), 400);
  }
  const id = evaluationPlanDocumentId(profile.id, context);
  const reference = collection(profile.schoolId).doc(id);
  const templateReference = getFirebaseAdminDatabase().collection("schools").doc(profile.schoolId).collection("evaluationTemplates").doc("current");
  return getFirebaseAdminDatabase().runTransaction(async (transaction) => {
    const [snapshot, templateSnapshot] = await Promise.all([transaction.get(reference), transaction.get(templateReference)]);
    const current = snapshot.exists ? parseStoredPlan(snapshot.data()) : null;
    if ((current?.revision ?? 0) !== params.expectedRevision) throw new EvaluationPlanWorkflowError("다른 화면에서 먼저 저장했습니다. 최신 내용을 다시 불러온 뒤 수정해 주세요.");
    if ((templateSnapshot.data()?.revision ?? 0) !== params.templateRevision) throw new EvaluationPlanWorkflowError("학교 양식이 변경되었습니다. 최신 양식을 다시 불러와 주세요.");
    const status = transitionEvaluationPlan({ profile, teacherUserId: current?.teacherUserId ?? profile.id, status: current?.status ?? "draft", action: params.action });
    const record: SavedEvaluationPlan = {
      id, teacherUserId: profile.id, teacherLabel: profile.displayName, context,
      status, revision: (current?.revision ?? 0) + 1,
      templateSignature: getEvaluationPlanTemplateSignature(template, context),
      updatedAt: new Date().toISOString(), reviewComment: current?.reviewComment ?? "",
      draft, template, calendarEvents,
    };
    const serialized = JSON.stringify(record);
    if (Buffer.byteLength(serialized, "utf8") > 850_000) throw new EvaluationPlanWorkflowError("평가계획 용량이 큽니다. 긴 입력 내용이나 학교 교표 크기를 줄여 주세요.", 400);
    transaction.set(reference, JSON.parse(serialized));
    return record;
  });
}

export async function reviewEvaluationPlan(params: {
  profile: UserProfile; id: string; expectedRevision: number; action: "approve" | "reject"; comment: string;
}): Promise<SavedEvaluationPlan> {
  if (!/^[a-f0-9]{64}$/.test(params.id)) throw new EvaluationPlanWorkflowError("평가계획을 찾을 수 없습니다.", 404);
  const reference = collection(params.profile.schoolId).doc(params.id);
  return getFirebaseAdminDatabase().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) throw new EvaluationPlanWorkflowError("평가계획을 찾을 수 없습니다.", 404);
    const current = parseStoredPlan(snapshot.data());
    if (current.revision !== params.expectedRevision) throw new EvaluationPlanWorkflowError("평가계획 상태가 변경되었습니다. 다시 불러와 확인해 주세요.");
    const status = transitionEvaluationPlan({ profile: params.profile, teacherUserId: current.teacherUserId, status: current.status, action: params.action });
    const patch = { status, revision: current.revision + 1, reviewComment: params.comment, updatedAt: new Date().toISOString() };
    transaction.update(reference, { ...patch, reviewedBy: params.profile.id });
    return { ...current, ...patch };
  });
}
