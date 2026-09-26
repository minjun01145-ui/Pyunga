import { NextResponse } from "next/server";

import { loadAcademicCalendar } from "@/modules/academic-calendar/server";
import { EVALUATION_AUTHORING_ROLES, isAuthenticationDisabled } from "@/modules/auth";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import {
  evaluationPlanWriteSchema,
  EvaluationPlanWorkflowError,
  resolveTeacherEvaluationContext,
  TeacherEvaluationContextUnavailableError,
} from "@/modules/evaluation-plan";
import {
  evaluationPlanDraftStorageScope,
  loadTeacherEvaluationPlan,
  writeEvaluationPlan,
} from "@/modules/evaluation-plan/server";
import { getSchoolSubject, getTeacherSchoolSubjectAssignment, listSchoolSubjects } from "@/modules/school/server";
import { loadEvaluationTemplateState } from "@/modules/template/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_AUTHORING_ROLES);
    const state = await loadEvaluationTemplateState(profile.schoolId);
    const url = new URL(request.url);
    const grade = parseGrade(url.searchParams.get("grade"));
    const previewRequested = url.searchParams.get("preview") === "1" && profile.role === "evaluation_admin";
    let contextProfile = profile;
    let previewMode = false;
    let readOnly = false;
    let legacySubjectLabel = profile.subjectLabel;

    if (previewRequested) {
      const availableSubjects = (await listSchoolSubjects(profile.schoolId))
        .filter((subject) => subject.activeForPlans)
        .map(({ id, name }) => ({ id, name }));
      const subjectId = url.searchParams.get("subjectId");
      if (!subjectId || !grade) {
        return NextResponse.json({
          previewSelectionRequired: true,
          previewSubjects: availableSubjects,
          template: state.template,
          templateRevision: state.revision,
        }, { headers: { "Cache-Control": "no-store, private" } });
      }
      const subject = await getSchoolSubject(profile.schoolId, subjectId);
      if (!subject || !subject.activeForPlans) {
        return NextResponse.json({ error: "작성 대상 과목 분류를 선택해 주세요." }, { status: 404 });
      }
      contextProfile = { ...profile, subjectId: subject.id, subjectLabel: subject.name, teachingGrades: [grade] };
      previewMode = true;
      legacySubjectLabel = undefined;
    } else if (!isAuthenticationDisabled() && profile.role === "teacher") {
      const assignment = await getTeacherSchoolSubjectAssignment(profile.schoolId, profile.id);
      if (!assignment) {
        throw new TeacherEvaluationContextUnavailableError();
      }
      contextProfile = {
        ...profile,
        subjectId: assignment.subject.id,
        subjectLabel: assignment.subject.name,
      };
      readOnly = !assignment.subject.activeForPlans;
      legacySubjectLabel = assignment.legacySubjectLabel;
    } else if (!isAuthenticationDisabled() && profile.role === "evaluation_admin" && profile.subjectId) {
      const subject = await getSchoolSubject(profile.schoolId, profile.subjectId);
      if (!subject || !subject.activeForPlans) throw new TeacherEvaluationContextUnavailableError();
      contextProfile = { ...profile, subjectLabel: subject.name };
    }

    const teacherContext = resolveTeacherEvaluationContext({
      demoMode: isAuthenticationDisabled(),
      profile: contextProfile,
      academicPeriod: state.template?.academicPeriod,
      ...(grade ? { grade } : {}),
    });
    const [calendarEvents, savedPlan] = await Promise.all([
      loadAcademicCalendar({ schoolId: profile.schoolId, academicYear: teacherContext.academicYear }),
      isAuthenticationDisabled() || previewMode
        ? null
        : loadTeacherEvaluationPlan({
          schoolId: profile.schoolId,
          userId: profile.id,
          context: teacherContext,
          legacySubjectLabel,
      }),
    ]);
    if (readOnly && !savedPlan) {
      throw new TeacherEvaluationContextUnavailableError();
    }
    return NextResponse.json({
      template: state.template,
      templateRevision: state.revision,
      teacherContext,
      calendarEvents,
      savedPlan,
      teachingGrades: previewMode ? [teacherContext.grade] : isAuthenticationDisabled() ? [teacherContext.grade] : profile.teachingGrades,
      persistence: isAuthenticationDisabled() ? "browser" : "server",
      draftStorageScope: isAuthenticationDisabled() || previewMode ? null : evaluationPlanDraftStorageScope(profile.schoolId, profile.id),
      previewMode,
      readOnly,
    }, { headers: { "Cache-Control": "no-store, private" } });
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
    if (new URL(request.url).searchParams.get("preview") === "1" && profile.role === "evaluation_admin") {
      return NextResponse.json({ error: "미리보기에서는 평가계획을 저장하거나 제출할 수 없습니다." }, { status: 403 });
    }
    if (isAuthenticationDisabled()) {
      return NextResponse.json({ error: "체험 모드에서는 이 브라우저에만 저장합니다. 제출은 로그인 후 이용해 주세요." }, { status: 403 });
    }
    const parsed = evaluationPlanWriteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "저장할 평가계획 형식이 올바르지 않습니다." }, { status: 400 });
    const state = await loadEvaluationTemplateState(profile.schoolId);
    if (!state.template || state.revision !== parsed.data.expectedTemplateRevision) {
      throw new EvaluationPlanWorkflowError("학교 양식이 변경되었습니다. 다시 불러와 주세요.");
    }
    let contextProfile = profile;
    if (profile.role === "teacher") {
      const assignment = await getTeacherSchoolSubjectAssignment(profile.schoolId, profile.id);
      if (!assignment || !assignment.subject.activeForPlans) throw new TeacherEvaluationContextUnavailableError();
      contextProfile = { ...profile, subjectId: assignment.subject.id, subjectLabel: assignment.subject.name };
    } else if (profile.subjectId) {
      const subject = await getSchoolSubject(profile.schoolId, profile.subjectId);
      if (!subject || !subject.activeForPlans) throw new TeacherEvaluationContextUnavailableError();
      contextProfile = { ...profile, subjectLabel: subject.name };
    }
    const context = resolveTeacherEvaluationContext({
      demoMode: false,
      profile: contextProfile,
      academicPeriod: state.template.academicPeriod,
      grade: Number(parsed.data.draft.grade),
    });
    const calendarEvents = await loadAcademicCalendar({ schoolId: profile.schoolId, academicYear: context.academicYear });
    const savedPlan = await writeEvaluationPlan({
      profile,
      context,
      draft: parsed.data.draft,
      template: state.template,
      templateRevision: state.revision,
      calendarEvents,
      expectedRevision: parsed.data.expectedRevision,
      action: parsed.data.action,
      existingPlanId: parsed.data.existingPlanId,
    });
    return NextResponse.json({ savedPlan }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError || error instanceof EvaluationPlanWorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TeacherEvaluationContextUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Evaluation plan save failed", error);
    return NextResponse.json({ error: "평가계획을 저장하지 못했습니다." }, { status: 500 });
  }
}

function parseGrade(value: string | null): 1 | 2 | 3 | undefined {
  if (value === "1") return 1;
  if (value === "2") return 2;
  if (value === "3") return 3;
  return undefined;
}
