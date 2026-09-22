import { NextResponse } from "next/server";

import { EVALUATION_MANAGEMENT_ROLES } from "@/modules/auth";
import {
  FirebaseUserAccountProvisioner,
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfileWithPasswordChanged,
  TeacherAccountNotFoundError,
} from "@/modules/auth/server";

export const runtime = "nodejs";

const accountProvisioner = new FirebaseUserAccountProvisioner();

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const profile = await requireFirebaseAuthenticatedProfileWithPasswordChanged(
      request,
      EVALUATION_MANAGEMENT_ROLES,
    );
    const { userId } = await context.params;
    const result = await accountProvisioner.resetPassword({
      schoolId: profile.schoolId,
      userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TeacherAccountNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Teacher password reset failed", error);
    return NextResponse.json({ error: "비밀번호를 초기화하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
