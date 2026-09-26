import { NextResponse } from "next/server";
import { z } from "zod";

import { EVALUATION_MANAGEMENT_ROLES } from "@/modules/auth";
import {
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfileWithPasswordChanged,
} from "@/modules/auth/server";
import {
  renameSchoolSubject,
  SchoolSubjectConflictError,
  SchoolSubjectNotFoundError,
  SchoolSubjectRevisionConflictError,
  setSchoolSubjectInclusion,
} from "@/modules/school/server";

export const runtime = "nodejs";

const patchSubjectSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: z.string().trim().min(1).max(80), expectedRevision: z.number().int().min(1) }).strict(),
  z.object({ action: z.literal("include"), activeForPlans: z.boolean(), expectedRevision: z.number().int().min(1) }).strict(),
]);

export async function PATCH(request: Request, context: { params: Promise<{ subjectId: string }> }) {
  try {
    const profile = await requireFirebaseAuthenticatedProfileWithPasswordChanged(request, EVALUATION_MANAGEMENT_ROLES);
    const { subjectId } = await context.params;
    if (!/^([A-Za-z0-9_-]){1,128}$/.test(subjectId)) {
      return NextResponse.json({ error: "과목 분류를 찾을 수 없습니다." }, { status: 404 });
    }
    const parsed = patchSubjectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "과목 분류 변경 내용을 확인해 주세요." }, { status: 400 });
    const result = parsed.data.action === "rename"
      ? { subject: await renameSchoolSubject({ schoolId: profile.schoolId, subjectId, ...parsed.data }), deleted: false }
      : await setSchoolSubjectInclusion({ schoolId: profile.schoolId, subjectId, ...parsed.data });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SchoolSubjectNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SchoolSubjectRevisionConflictError || error instanceof SchoolSubjectConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("School subject update failed", error);
    return NextResponse.json({ error: "과목 분류를 저장하지 못했습니다." }, { status: 500 });
  }
}
