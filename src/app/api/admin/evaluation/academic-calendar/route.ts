import { NextResponse } from "next/server";

import { academicCalendarSaveSchema } from "@/modules/academic-calendar/application/academic-calendar-save";
import { saveAcademicCalendar } from "@/modules/academic-calendar/infrastructure/firestore-academic-calendar";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request, ["school_admin", "evaluation_admin"]);
    const parsed = academicCalendarSaveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "저장할 학사일정 데이터가 올바르지 않습니다." }, { status: 400 });
    }

    const savedCount = await saveAcademicCalendar({
      schoolId: profile.schoolId,
      userId: profile.id,
      input: parsed.data,
    });
    return NextResponse.json({ savedCount });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Academic calendar save failed", error);
    return NextResponse.json({ error: "학사일정을 저장하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
