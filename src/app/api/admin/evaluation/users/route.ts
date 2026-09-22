import { NextResponse } from "next/server";
import { z } from "zod";

import { EVALUATION_MANAGEMENT_ROLES } from "@/modules/auth";
import {
  FirebaseUserAccountProvisioner,
  listSchoolTeacherAccounts,
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfileWithPasswordChanged,
} from "@/modules/auth/server";

export const runtime = "nodejs";

const createTeacherSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  subjectLabel: z.string().trim().min(1).max(80),
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
    });
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
      return NextResponse.json({ error: "이름, 교과, 수업 학년을 확인해 주세요." }, { status: 400 });
    }

    const teachingGrades = [...new Set(parsed.data.teachingGrades)].sort((left, right) => left - right);
    const provisioned = await accountProvisioner.provision({
      schoolId: profile.schoolId,
      displayName: parsed.data.displayName,
      subjectLabel: parsed.data.subjectLabel,
      teachingGrades,
      role: "teacher",
    });

    return NextResponse.json({
      user: {
        id: provisioned.userId,
        loginIdentifier: provisioned.loginIdentifier,
        displayName: parsed.data.displayName,
        subjectLabel: parsed.data.subjectLabel,
        teachingGrades,
        active: true,
        mustChangePassword: true,
      },
      temporaryPassword: provisioned.temporaryPassword,
    });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Teacher account creation failed", error);
    return NextResponse.json({ error: "사용자 계정을 만드는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
