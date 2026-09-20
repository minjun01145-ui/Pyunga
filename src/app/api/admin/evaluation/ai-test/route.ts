import { NextResponse } from "next/server";
import { z } from "zod";

import { createOllamaTextClientFromEnv, OllamaAiError } from "@/modules/ai-review/server";
import { EVALUATION_MANAGEMENT_ROLES } from "@/modules/auth";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUESTS_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2_000),
});

const requestSchema = z
  .object({
    messages: z.array(chatMessageSchema).min(1).max(12),
  })
  .refine((value) => value.messages.at(-1)?.role === "user", {
    message: "마지막 메시지는 사용자 질문이어야 합니다.",
  });

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const requestCounts = new Map<string, RateLimitEntry>();

export async function POST(request: Request) {
  try {
    await requireAuthenticatedProfile(request, EVALUATION_MANAGEMENT_ROLES);
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const rateLimit = consumeRequest(getClientKey(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "대화 내용이 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const aiClient = createOllamaTextClientFromEnv();
    const startedAt = Date.now();
    const answer = await aiClient.generateText({
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "당신은 학교 평가업무 시스템의 AI 연결 점검용 도우미입니다. 질문에 한국어로 간결하고 명확하게 답하세요.",
        },
        ...parsed.data.messages,
      ],
    });

    return NextResponse.json({
      answer,
      durationMs: Math.max(1, Date.now() - startedAt),
    });
  } catch (error) {
    if (error instanceof OllamaAiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    console.error("AI connection test failed", error);
    return NextResponse.json({ error: "AI 응답을 받는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

function getClientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function consumeRequest(clientKey: string):
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const current = requestCounts.get(clientKey);

  if (!current || current.resetAt <= now) {
    requestCounts.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1_000)),
    };
  }

  current.count += 1;
  return { allowed: true };
}
