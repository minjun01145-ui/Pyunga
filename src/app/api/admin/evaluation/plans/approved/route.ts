import { NextResponse } from "next/server";

import { EVALUATION_MANAGEMENT_ROLES, isAuthenticationDisabled } from "@/modules/auth";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import { EvaluationPlanWorkflowError } from "@/modules/evaluation-plan";
import { listApprovedEvaluationPlans } from "@/modules/evaluation-plan/server";
import { loadEvaluationTemplateState } from "@/modules/template/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_MANAGEMENT_ROLES);
    if (isAuthenticationDisabled()) {
      return NextResponse.json({ plans: [], demoMode: true });
    }

    const { template } = await loadEvaluationTemplateState(profile.schoolId);
    const academicPeriod = template?.academicPeriod;
    if (!academicPeriod) {
      return NextResponse.json(
        { error: "학교 기본 양식에서 작성 학년도와 학기를 먼저 설정해 주세요." },
        { status: 409 },
      );
    }

    const plans = await listApprovedEvaluationPlans({
      schoolId: profile.schoolId,
      academicYear: academicPeriod.academicYear,
      semester: academicPeriod.semester,
    });
    return NextResponse.json({ plans, academicPeriod, demoMode: false });
  } catch (error) {
    if (error instanceof RequestAuthenticationError || error instanceof EvaluationPlanWorkflowError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Approved evaluation plan compilation failed", error);
    return NextResponse.json({ error: "승인된 평가계획을 취합하지 못했습니다." }, { status: 500 });
  }
}
