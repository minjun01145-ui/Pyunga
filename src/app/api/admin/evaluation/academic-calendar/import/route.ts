import { NextResponse } from "next/server";

import {
  AcademicCalendarImportError,
  extractPdfTextPages,
  importAcademicCalendarFromText,
  selectAcademicCalendarSourceText,
} from "@/modules/academic-calendar/server";
import { createOllamaJsonClientFromEnv, OllamaAiError } from "@/modules/ai-review/server";

export const runtime = "nodejs";

const ACADEMIC_CALENDAR_AI_TIMEOUT_MS = 240_000;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const academicYear = Number(formData.get("academicYear"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF 파일을 선택해 주세요." }, { status: 400 });
    }

    if (!isPdfFile(file)) {
      return NextResponse.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    const extracted = await extractPdfTextPages(file);
    const source = selectAcademicCalendarSourceText(extracted.pages);
    const aiClient = createOllamaJsonClientFromEnv({
      timeoutMs: ACADEMIC_CALENDAR_AI_TIMEOUT_MS,
      think: "low",
    });
    const result = await importAcademicCalendarFromText({
      academicYear,
      sourceText: source.text,
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
    if (error instanceof AcademicCalendarImportError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof OllamaAiError) {
      const message =
        error.message === "Ollama 응답 시간이 초과되었습니다."
          ? "AI가 4분 안에 학사일정 분석을 마치지 못했습니다. PDF에서 학사일정 페이지만 분리해 다시 시도해 주세요."
          : error.message;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    console.error("Academic calendar import failed", error);
    return NextResponse.json({ error: "학사일정 분석 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
