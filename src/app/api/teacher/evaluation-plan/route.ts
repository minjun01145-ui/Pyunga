import { NextResponse } from "next/server";

import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import { loadEvaluationTemplate } from "@/modules/template/server";

export const runtime = "nodejs";

const ALLOWED_ROLES = ["teacher", "evaluation_admin", "school_admin"] as const;

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, ALLOWED_ROLES);
    const template = await loadEvaluationTemplate(profile.schoolId);
    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Evaluation plan workspace load failed", error);
    return NextResponse.json({ error: "평가계획 작성 자료를 불러오는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
