import { NextResponse } from "next/server";

import { loadAcademicCalendar } from "@/modules/academic-calendar/server";
import { EVALUATION_AUTHORING_ROLES, isAuthenticationDisabled } from "@/modules/auth";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import {
  resolveTeacherEvaluationContext,
  TeacherEvaluationContextUnavailableError,
} from "@/modules/evaluation-plan";
import { loadEvaluationTemplate } from "@/modules/template/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_AUTHORING_ROLES);
    const teacherContext = resolveTeacherEvaluationContext({ demoMode: isAuthenticationDisabled() });
    const [template, calendarEvents] = await Promise.all([
      loadEvaluationTemplate(profile.schoolId),
      loadAcademicCalendar({
        schoolId: profile.schoolId,
        academicYear: teacherContext.academicYear,
      }),
    ]);
    return NextResponse.json({ template, teacherContext, calendarEvents });
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
