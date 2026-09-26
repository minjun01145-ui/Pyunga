import { NextResponse } from "next/server";

import { loadAcademicCalendar } from "@/modules/academic-calendar/server";
import { EVALUATION_AUTHORING_ROLES, isAuthenticationDisabled } from "@/modules/auth";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import {
  resolveTeacherEvaluationContext,
  TeacherEvaluationContextUnavailableError,
  evaluationPlanWriteSchema,
  EvaluationPlanWorkflowError,
} from "@/modules/evaluation-plan";
import { evaluationPlanDocumentId, evaluationPlanDraftStorageScope, loadSavedEvaluationPlan, writeEvaluationPlan } from "@/modules/evaluation-plan/server";
import { loadEvaluationTemplateState } from "@/modules/template/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_AUTHORING_ROLES);
    const state = await loadEvaluationTemplateState(profile.schoolId);
    const grade = new URL(request.url).searchParams.get("grade");
    const teacherContext = resolveTeacherEvaluationContext({ demoMode: isAuthenticationDisabled(), profile, academicPeriod: state.template?.academicPeriod, ...(grade ? { grade: Number(grade) } : {}) });
    const [calendarEvents, savedPlan] = await Promise.all([
      loadAcademicCalendar({
        schoolId: profile.schoolId,
        academicYear: teacherContext.academicYear,
      }),
      isAuthenticationDisabled() ? null : loadSavedEvaluationPlan(profile.schoolId, evaluationPlanDocumentId(profile.id, teacherContext)),
    ]);
    return NextResponse.json({ template: state.template, templateRevision: state.revision, teacherContext, calendarEvents, savedPlan, teachingGrades: isAuthenticationDisabled() ? [teacherContext.grade] : profile.teachingGrades, persistence: isAuthenticationDisabled() ? "browser" : "server", draftStorageScope: isAuthenticationDisabled() ? null : evaluationPlanDraftStorageScope(profile.schoolId, profile.id) });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TeacherEvaluationContextUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Evaluation plan workspace load failed", error);
    return NextResponse.json({ error: "평가계획 작성 자료를 불러오는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_AUTHORING_ROLES);
    if (isAuthenticationDisabled()) return NextResponse.json({ error: "체험 모드에서는 이 브라우저에만 저장합니다. 제출은 로그인 후 이용해 주세요." }, { status: 403 });
    const parsed = evaluationPlanWriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "저장할 평가계획 형식이 올바르지 않습니다." }, { status: 400 });
    const state = await loadEvaluationTemplateState(profile.schoolId);
    if (!state.template || state.revision !== parsed.data.expectedTemplateRevision) throw new EvaluationPlanWorkflowError("학교 양식이 변경되었습니다. 다시 불러와 주세요.");
    const context = resolveTeacherEvaluationContext({ demoMode: false, profile, academicPeriod: state.template.academicPeriod, grade: Number(parsed.data.draft.grade) });
    const calendarEvents = await loadAcademicCalendar({ schoolId: profile.schoolId, academicYear: context.academicYear });
    const savedPlan = await writeEvaluationPlan({ profile, context, draft: parsed.data.draft, template: state.template, templateRevision: state.revision, calendarEvents, expectedRevision: parsed.data.expectedRevision, action: parsed.data.action });
    return NextResponse.json({ savedPlan });
  } catch (error) {
    if (error instanceof RequestAuthenticationError || error instanceof EvaluationPlanWorkflowError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof TeacherEvaluationContextUnavailableError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Evaluation plan save failed", error);
    return NextResponse.json({ error: "평가계획을 저장하지 못했습니다." }, { status: 500 });
  }
}
