import { NextResponse } from "next/server";

import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const profile = await requireAuthenticatedProfile(request);
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      });
    }
    console.error("Session profile lookup failed", error);
    return NextResponse.json({ error: "로그인 정보를 확인하지 못했습니다." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
