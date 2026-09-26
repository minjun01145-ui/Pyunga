import { NextResponse } from "next/server";
import { z } from "zod";

import { EVALUATION_MANAGEMENT_ROLES } from "@/modules/auth";
import {
  FirebaseUserAccountProvisioner,
  listSchoolTeacherAccounts,
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfileWithPasswordChanged,
  TeacherAccountPasswordConflictError,
} from "@/modules/auth/server";
import { getSchoolSubject, SchoolSubjectNotFoundError } from "@/modules/school/server";

export const runtime = "nodejs";

const createTeacherSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  subjectId: z.string().regex(/^([A-Za-z0-9_-]){1,128}$/),
  teachingGrades: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).min(1).max(3),
});

const accountProvisioner = new FirebaseUserAccountProvisioner();

export async function GET(request: Request) {
  try {
    const profile = await requireFirebaseAuthenticatedProfileWithPasswordChanged(
      request,
      EVALUATION_MANAGEMENT_ROLES,
    );
    return NextResponse.json({
      users: await listSchoolTeacherAccounts(profile.schoolId),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Teacher account list failed", error);
    return NextResponse.json({ error: "사용자 목록을 불러오는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireFirebaseAuthenticatedProfileWithPasswordChanged(
      request,
      EVALUATION_MANAGEMENT_ROLES,
    );
    const parsed = createTeacherSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "이름, 과목 분류, 수업 학년을 확인해 주세요." }, { status: 400 });
    }

    const subject = await getSchoolSubject(profile.schoolId, parsed.data.subjectId);
    if (!subject || !subject.activeForPlans) throw new SchoolSubjectNotFoundError();
    const teachingGrades = [...new Set(parsed.data.teachingGrades)].sort((left, right) => left - right);
    const provisioned = await accountProvisioner.provision({
      schoolId: profile.schoolId,
      displayName: parsed.data.displayName,
      subjectId: subject.id,
      subjectLabel: subject.name,
      teachingGrades,
      role: "teacher",
    });

    return NextResponse.json({
      user: {
        id: provisioned.userId,
        loginIdentifier: provisioned.loginIdentifier,
        displayName: parsed.data.displayName,
        subjectLabel: subject.name,
        subjectId: subject.id,
        teachingGrades,
        active: true,
        mustChangePassword: true,
        temporaryPasswordState: "available",
        temporaryPassword: provisioned.temporaryPassword,
      },
      temporaryPassword: provisioned.temporaryPassword,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SchoolSubjectNotFoundError) {
      return NextResponse.json({ error: "사용 중인 과목 분류를 선택해 주세요." }, { status: 409 });
    }
    if (error instanceof TeacherAccountPasswordConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Teacher account creation failed", error);
    return NextResponse.json({ error: "사용자 계정을 만드는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
