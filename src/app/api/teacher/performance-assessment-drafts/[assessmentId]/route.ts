import { NextResponse } from "next/server";

import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import { performanceAssessmentDraftSchema } from "@/modules/performance-assessment/application/performance-assessment-draft";
import { savePerformanceAssessmentDraft } from "@/modules/performance-assessment/infrastructure/firestore-performance-assessment-draft";

export const runtime = "nodejs";

export async function PUT(request: Request, context: { params: Promise<{ assessmentId: string }> }) {
  try {
    const profile = await requireAuthenticatedProfile(request, ["teacher", "evaluation_admin", "school_admin"]);
    const { assessmentId } = await context.params;
    const parsed = performanceAssessmentDraftSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || parsed.data.id !== assessmentId) {
      return NextResponse.json({ error: "저장할 수행평가 데이터가 올바르지 않습니다." }, { status: 400 });
    }

    await savePerformanceAssessmentDraft({
      schoolId: profile.schoolId,
      userId: profile.id,
      assessment: parsed.data,
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Performance assessment draft save failed", error);
    return NextResponse.json({ error: "수행평가 초안을 저장하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
