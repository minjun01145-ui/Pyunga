import { NextResponse } from "next/server";
import { EVALUATION_MANAGEMENT_ROLES, isAuthenticationDisabled } from "@/modules/auth";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import { EvaluationPlanWorkflowError, filterPlansForActiveSubjects } from "@/modules/evaluation-plan";
import { listSavedEvaluationPlans } from "@/modules/evaluation-plan/server";
import { listSchoolSubjects } from "@/modules/school/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_MANAGEMENT_ROLES);
    if (isAuthenticationDisabled()) return NextResponse.json({ plans: [], demoMode: true });
    const [plans, subjects] = await Promise.all([
      listSavedEvaluationPlans(profile.schoolId),
      listSchoolSubjects(profile.schoolId),
    ]);
    return NextResponse.json({ plans: filterPlansForActiveSubjects(plans, subjects), demoMode: false });
  } catch (error) {
    if (error instanceof RequestAuthenticationError || error instanceof EvaluationPlanWorkflowError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Evaluation plan list failed", error);
    return NextResponse.json({ error: "작성 현황을 불러오지 못했습니다." }, { status: 500 });
  }
}
