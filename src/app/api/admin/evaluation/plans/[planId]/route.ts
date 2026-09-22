import { NextResponse } from "next/server";
import { EVALUATION_MANAGEMENT_ROLES, isAuthenticationDisabled } from "@/modules/auth";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import { evaluationPlanReviewSchema, EvaluationPlanWorkflowError } from "@/modules/evaluation-plan";
import { loadSavedEvaluationPlan, reviewEvaluationPlan } from "@/modules/evaluation-plan/server";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ planId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_MANAGEMENT_ROLES);
    if (isAuthenticationDisabled()) throw new EvaluationPlanWorkflowError("로그인 후 제출본을 확인할 수 있습니다.", 403);
    const plan = await loadSavedEvaluationPlan(profile.schoolId, (await context.params).planId);
    if (!plan) throw new EvaluationPlanWorkflowError("평가계획을 찾을 수 없습니다.", 404);
    return NextResponse.json({ plan });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_MANAGEMENT_ROLES);
    if (isAuthenticationDisabled()) throw new EvaluationPlanWorkflowError("로그인 후 검토할 수 있습니다.", 403);
    const parsed = evaluationPlanReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new EvaluationPlanWorkflowError("검토 내용을 확인해 주세요. 반려 시 사유가 필요합니다.", 400);
    const plan = await reviewEvaluationPlan({ profile, id: (await context.params).planId, ...parsed.data });
    return NextResponse.json({ plan });
  } catch (error) { return errorResponse(error); }
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthenticationError || error instanceof EvaluationPlanWorkflowError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("Evaluation plan review failed", error);
  return NextResponse.json({ error: "평가계획 검토 처리에 실패했습니다." }, { status: 500 });
}
