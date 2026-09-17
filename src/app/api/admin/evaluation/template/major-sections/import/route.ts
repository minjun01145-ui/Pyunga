import { NextResponse } from "next/server";

import { createOllamaJsonClientFromEnv, OllamaAiError } from "@/modules/ai-review/server";
import { RequestAuthenticationError, requireAuthenticatedProfile } from "@/modules/auth/server";
import {
  EvaluationTemplateImportError,
  extractEvaluationTemplatePdfText,
  importEvaluationTemplateFromText,
  selectEvaluationTemplateSourceText,
} from "@/modules/template/server";

export const runtime = "nodejs";

const EVALUATION_TEMPLATE_AI_TIMEOUT_MS = 240_000;

export async function POST(request: Request) {
  try {
    await requireAuthenticatedProfile(request, ["school_admin", "evaluation_admin"]);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF 파일을 선택해 주세요." }, { status: 400 });
    }

    if (!isPdfFile(file)) {
      return NextResponse.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    const extracted = await extractEvaluationTemplatePdfText(file);
    const source = selectEvaluationTemplateSourceText(extracted.pages);
    const aiClient = createOllamaJsonClientFromEnv({
      timeoutMs: EVALUATION_TEMPLATE_AI_TIMEOUT_MS,
      think: "low",
    });
    const result = await importEvaluationTemplateFromText({
      sourceText: source.text,
      headingHints: source.headingHints,
      aiClient,
    });

    return NextResponse.json({
      ...result,
      source: {
        fileName: file.name,
        totalPages: extracted.totalPages,
        selectedPages: source.pageNumbers,
      },
    });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof EvaluationTemplateImportError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof OllamaAiError) {
      const message =
        error.message === "Ollama 응답 시간이 초과되었습니다."
          ? "평가계획 구조 분석이 제한 시간 안에 끝나지 않았습니다. PDF 분량을 줄여 다시 시도해 주세요."
          : error.message;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    console.error("Evaluation template import failed", error);
    return NextResponse.json({ error: "평가계획 구조를 분석하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
