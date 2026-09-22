import { NextResponse } from "next/server";
import { z } from "zod";

import {
  changeUserPassword,
  PasswordChangeError,
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfile,
} from "@/modules/auth/server";

export const runtime = "nodejs";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(64),
});

export async function POST(request: Request) {
  try {
    const profile = await requireFirebaseAuthenticatedProfile(request);
    const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "새 비밀번호는 6~64자로 입력해 주세요." }, { status: 400 });
    }

    await changeUserPassword({
      userId: profile.id,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });
    return NextResponse.json({ changed: true });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof PasswordChangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Password change failed", error);
    return NextResponse.json({ error: "비밀번호를 변경하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
