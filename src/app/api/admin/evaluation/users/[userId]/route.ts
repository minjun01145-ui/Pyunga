import { NextResponse } from "next/server";
import { z } from "zod";

import { EVALUATION_MANAGEMENT_ROLES, type TeachingGrade } from "@/modules/auth";
import {
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfileWithPasswordChanged,
} from "@/modules/auth/server";
import {
  TeacherAccountNotFoundError,
  updateSchoolTeacherAccount,
} from "@/modules/auth/server";

export const runtime = "nodejs";

const updateTeacherSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  subjectLabel: z.string().trim().min(1).max(80),
  teachingGrades: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).min(1).max(3),
  active: z.boolean(),
}).strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const profile = await requireFirebaseAuthenticatedProfileWithPasswordChanged(
      request,
      EVALUATION_MANAGEMENT_ROLES,
    );
    const userId = (await context.params).userId;
    if (!/^[A-Za-z0-9-]{1,128}$/.test(userId)) {
      return NextResponse.json({ error: "사용자 계정을 찾을 수 없습니다." }, { status: 404 });
    }

    const parsed = updateTeacherSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "이름, 교과, 수업 학년과 계정 상태를 확인해 주세요." }, { status: 400 });
    }

    const teachingGrades: TeachingGrade[] = [...new Set(parsed.data.teachingGrades)].sort((left, right) => left - right);
    const user = await updateSchoolTeacherAccount({
      schoolId: profile.schoolId,
      userId,
      ...parsed.data,
      teachingGrades,
    });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TeacherAccountNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Teacher account update failed", error);
    return NextResponse.json({ error: "사용자 담당 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}
