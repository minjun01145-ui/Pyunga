import { NextResponse } from "next/server";

import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import {
  loadEvaluationTemplate,
  parseEvaluationTemplateSaveInput,
  saveEvaluationTemplate,
} from "@/modules/template/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, ["school_admin", "evaluation_admin"]);
    const template = await loadEvaluationTemplate(profile.schoolId);
    return NextResponse.json({ template });
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
    const profile = await requireAuthenticatedProfile(request, ["school_admin", "evaluation_admin"]);
    const template = parseEvaluationTemplateSaveInput(await request.json().catch(() => null));
    if (!template) {
      return NextResponse.json({ error: "저장할 평가계획 양식 데이터가 올바르지 않습니다." }, { status: 400 });
    }

    await saveEvaluationTemplate({
      schoolId: profile.schoolId,
      userId: profile.id,
      template,
    });

    return NextResponse.json({ savedCount: template.sections.length });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Evaluation template save failed", error);
    return NextResponse.json({ error: "평가계획 양식을 저장하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
