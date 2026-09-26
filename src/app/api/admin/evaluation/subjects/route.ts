import { NextResponse } from "next/server";
import { z } from "zod";

import { EVALUATION_MANAGEMENT_ROLES } from "@/modules/auth";
import {
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfileWithPasswordChanged,
  listSchoolTeacherAccounts,
} from "@/modules/auth/server";
import { loadEvaluationTemplateState } from "@/modules/template/server";
import {
  createSchoolSubject,
  listSchoolSubjects,
  SchoolSubjectConflictError,
} from "@/modules/school/server";

export const runtime = "nodejs";

const createSubjectsSchema = z.object({
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(100),
}).strict();

export async function GET(request: Request) {
  try {
    const profile = await requireFirebaseAuthenticatedProfileWithPasswordChanged(request, EVALUATION_MANAGEMENT_ROLES);
    const subjects = await listSchoolSubjects(profile.schoolId);
    const [users, templateState] = await Promise.all([
      listSchoolTeacherAccounts(profile.schoolId),
      loadEvaluationTemplateState(profile.schoolId),
    ]);
    return NextResponse.json({
      subjects,
      users,
      targetAcademicYear: templateState.template?.academicPeriod?.academicYear ?? null,
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("School subject list failed", error);
    return NextResponse.json({ error: "과목 분류를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireFirebaseAuthenticatedProfileWithPasswordChanged(request, EVALUATION_MANAGEMENT_ROLES);
    const parsed = createSubjectsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "과목명을 확인해 주세요." }, { status: 400 });

    const created = [];
    for (const name of [...new Set(parsed.data.names)]) {
      created.push(await createSchoolSubject({ schoolId: profile.schoolId, name }));
    }
    return NextResponse.json({ subjects: created }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SchoolSubjectConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("School subject creation failed", error);
    return NextResponse.json({ error: "과목 분류를 추가하지 못했습니다." }, { status: 500 });
  }
}
