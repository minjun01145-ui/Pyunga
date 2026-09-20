import { NextResponse } from "next/server";

import { EVALUATION_MANAGEMENT_ROLES } from "@/modules/auth";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import {
  EvaluationTemplateRevisionConflictError,
  loadEvaluationTemplateState,
  parseEvaluationTemplateSaveRequest,
  saveEvaluationTemplate,
} from "@/modules/template/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_MANAGEMENT_ROLES);
    const state = await loadEvaluationTemplateState(profile.schoolId);
    return NextResponse.json(state);
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Evaluation template load failed", error);
    return NextResponse.json({ error: "평가계획 양식을 불러오는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, EVALUATION_MANAGEMENT_ROLES);
    const saveRequest = parseEvaluationTemplateSaveRequest(await request.json().catch(() => null));
    if (!saveRequest) {
      return NextResponse.json({ error: "저장할 평가계획 양식 데이터가 올바르지 않습니다." }, { status: 400 });
    }

    const revision = await saveEvaluationTemplate({
      schoolId: profile.schoolId,
      userId: profile.id,
      template: saveRequest.template,
      expectedRevision: saveRequest.expectedRevision,
    });

    return NextResponse.json({
      savedCount: saveRequest.template.sections.length,
      revision,
    });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof EvaluationTemplateRevisionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Evaluation template save failed", error);
    return NextResponse.json({ error: "평가계획 양식을 저장하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
