import { NextResponse } from "next/server";
import { z } from "zod";

import { EVALUATION_MANAGEMENT_ROLES, type TeachingGrade } from "@/modules/auth";
import {
  getSchoolTeacherSubjectId,
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfileWithPasswordChanged,
  TeacherAccountNotFoundError,
  updateSchoolTeacherAccount,
} from "@/modules/auth/server";
import { getSchoolSubject, SchoolSubjectNotFoundError } from "@/modules/school/server";

export const runtime = "nodejs";

const updateTeacherSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  subjectId: z.string().regex(/^([A-Za-z0-9_-]){1,128}$/),
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
      return NextResponse.json({ error: "이름, 과목 분류, 수업 학년과 계정 상태를 확인해 주세요." }, { status: 400 });
    }

    const [subject, existingSubjectId] = await Promise.all([
      getSchoolSubject(profile.schoolId, parsed.data.subjectId),
      getSchoolTeacherSubjectId(profile.schoolId, userId),
    ]);
    if (!subject || (parsed.data.subjectId !== existingSubjectId && !subject.activeForPlans)) {
      throw new SchoolSubjectNotFoundError();
    }
    const teachingGrades: TeachingGrade[] = [...new Set(parsed.data.teachingGrades)].sort((left, right) => left - right);
    const user = await updateSchoolTeacherAccount({
      schoolId: profile.schoolId,
      userId,
      ...parsed.data,
      ...(parsed.data.subjectId === existingSubjectId ? {} : { subjectLabel: subject.name }),
      teachingGrades,
    });
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof TeacherAccountNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SchoolSubjectNotFoundError) {
      return NextResponse.json({ error: "유효한 과목 분류를 선택해 주세요." }, { status: 409 });
    }
    console.error("Teacher account update failed", error);
    return NextResponse.json({ error: "사용자 담당 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}
