import { NextResponse } from "next/server";
import { z } from "zod";

import { createOllamaJsonClientFromEnv, OllamaAiError } from "@/modules/ai-review/server";
import { EVALUATION_MANAGEMENT_ROLES } from "@/modules/auth";
import {
  RequestAuthenticationError,
  requireFirebaseAuthenticatedProfileWithPasswordChanged,
} from "@/modules/auth/server";
import { loadEvaluationTemplateState } from "@/modules/template/server";
import {
  CurriculumPdfImportError,
  CurriculumSubjectImportError,
  extractCurriculumPdfText,
  importCurriculumSubjects,
} from "@/modules/school/server";

export const runtime = "nodejs";

const MAX_PASTED_TEXT_LENGTH = 50_000;
const CURRICULUM_AI_TIMEOUT_MS = 240_000;

export async function POST(request: Request) {
  try {
    const profile = await requireFirebaseAuthenticatedProfileWithPasswordChanged(request, EVALUATION_MANAGEMENT_ROLES);
    const formData = await request.formData();
    const templateState = await loadEvaluationTemplateState(profile.schoolId);
    const targetAcademicYear = templateState.template?.academicPeriod?.academicYear;
    if (!targetAcademicYear) {
      return NextResponse.json({
        error: "작성 학년도가 설정되지 않았습니다. 평가계획 양식 관리에서 작성 학년도를 먼저 설정해 주세요.",
      }, { status: 409 });
    }

    const file = formData.get("file");
    let sourceText: string;
    let source: { kind: "pdf"; fileName: string; totalPages: number } | { kind: "pasted_text" };
    if (file instanceof File && file.size > 0) {
      if (!isPdfFile(file)) return NextResponse.json({ error: "PDF 파일만 분석할 수 있습니다." }, { status: 400 });
      const extracted = await extractCurriculumPdfText(file);
      sourceText = extracted.sourceText;
      source = { kind: "pdf", fileName: file.name.slice(0, 180), totalPages: extracted.totalPages };
    } else {
      const pastedText = z.string().trim().min(1).max(MAX_PASTED_TEXT_LENGTH)
        .safeParse(formData.get("pastedText"));
      if (!pastedText.success) {
        return NextResponse.json({ error: `PDF를 올리거나 표 내용을 ${MAX_PASTED_TEXT_LENGTH.toLocaleString("ko-KR")}자 이내로 붙여 넣어 주세요.` }, { status: 400 });
      }
      sourceText = pastedText.data;
      source = { kind: "pasted_text" };
    }

    const assessment = await importCurriculumSubjects({
      targetAcademicYear,
      sourceText,
      aiClient: createOllamaJsonClientFromEnv({ timeoutMs: CURRICULUM_AI_TIMEOUT_MS, think: "low" }),
    });
    return NextResponse.json({ assessment, source }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof RequestAuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CurriculumPdfImportError || error instanceof CurriculumSubjectImportError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof OllamaAiError) {
      return NextResponse.json({ error: "교육과정표를 분석하지 못했습니다. 표 내용을 붙여 넣어 다시 시도해 주세요." }, { status: 502 });
    }
    console.error("Curriculum subject import failed", error);
    return NextResponse.json({ error: "교육과정표를 분석하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
