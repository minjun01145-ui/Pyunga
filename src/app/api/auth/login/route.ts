import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateUserLogin, InvalidLoginError } from "@/modules/auth/server";

export const runtime = "nodejs";

const loginSchema = z.object({
  loginIdentifier: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "아이디 또는 비밀번호를 확인해 주세요." }, { status: 400 });
    }

    return NextResponse.json(await authenticateUserLogin(parsed.data));
  } catch (error) {
    if (error instanceof InvalidLoginError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("User login failed", error);
    return NextResponse.json({ error: "로그인 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
