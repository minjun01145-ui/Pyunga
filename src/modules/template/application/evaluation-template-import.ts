import { z } from "zod";

import type { ExtractedPdfPage } from "@/shared/pdf/pdf-text-extractor";
import type { AiCallMetrics, AiJsonClient } from "../../ai-review";
import {
  normalizeEvaluationTemplateSections,
  type EvaluationTemplate,
  type EvaluationTemplateSection,
  type EvaluationTemplateSectionInput,
  type EvaluationTemplateSectionLevel,
} from "../domain/evaluation-template";

const aiHeadingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  level: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ]),
  pageNumber: z.number().int().min(1).max(60).nullable().optional(),
});

const aiImportResponseSchema = z.object({
  documentTitle: z.string().trim().min(1).max(200).nullable().optional(),
  headings: z.array(aiHeadingSchema).min(1).max(100),
  warnings: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
});

export type EvaluationTemplateSourceSelection = {
  text: string;
  pageNumbers: number[];
  headingHints: string[];
};

export type EvaluationTemplateImportResult = EvaluationTemplate & {
  warnings: string[];
  aiCall: AiCallMetrics;
};

const MAX_SOURCE_PAGES = 30;
const MAX_SOURCE_CHARACTERS = 120_000;
const MAX_HEADING_HINTS = 120;

export class EvaluationTemplateImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvaluationTemplateImportError";
  }
}

export function selectEvaluationTemplateSourceText(
  pages: readonly ExtractedPdfPage[],
): EvaluationTemplateSourceSelection {
  const selected: ExtractedPdfPage[] = [];
  let characterCount = 0;

  for (const page of pages.slice(0, MAX_SOURCE_PAGES)) {
    const text = normalizeWhitespace(page.text);
    if (!text) continue;

    const section = `--- PAGE ${page.pageNumber} ---\n${text}`;
    if (section.length > MAX_SOURCE_CHARACTERS) {
      throw new EvaluationTemplateImportError("평가계획 PDF의 한 페이지 텍스트가 너무 커서 분석할 수 없습니다.");
    }
    if (characterCount + section.length > MAX_SOURCE_CHARACTERS) {
      break;
    }

    selected.push({ pageNumber: page.pageNumber, text });
    characterCount += section.length;
  }

  if (selected.length === 0) {
    throw new EvaluationTemplateImportError("평가계획 PDF에서 읽을 수 있는 텍스트를 찾지 못했습니다.");
  }

  const text = selected
    .map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  return {
    text,
    pageNumbers: selected.map((page) => page.pageNumber),
    headingHints: collectHeadingHints(selected),
  };
}

export async function importEvaluationTemplateFromText(params: {
  sourceText: string;
  headingHints: readonly string[];
  aiClient: AiJsonClient;
}): Promise<EvaluationTemplateImportResult> {
  if (params.sourceText.trim().length < 20) {
    throw new EvaluationTemplateImportError("평가계획 구조를 분석할 수 있는 문서 텍스트가 충분하지 않습니다.");
  }

  const response = await params.aiClient.generateJson({
    temperature: 0,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(params.sourceText, params.headingHints) },
    ],
  });

  const parsed = aiImportResponseSchema.safeParse(response.data);
  if (!parsed.success) {
    throw new EvaluationTemplateImportError(
      "AI 응답 형식이 평가계획 양식 스키마와 맞지 않습니다. 다시 분석해 주세요.",
    );
  }

  const inputs = removeAdjacentDuplicates(
    parsed.data.headings.map((heading, index): EvaluationTemplateSectionInput => ({
      id: `section-${index + 1}`,
      title: cleanHeadingTitle(heading.title),
      level: heading.level,
      ...(heading.pageNumber ? { sourcePage: heading.pageNumber } : {}),
    })),
  ).map((heading, index) => ({ ...heading, id: `section-${index + 1}` }));

  const sections = assignStableImportedIds(normalizeEvaluationTemplateSections(inputs));
  if (sections.filter((section) => section.level === 1).length === 0) {
    throw new EvaluationTemplateImportError("문서에서 대분류를 찾지 못했습니다. 분석 결과를 다시 확인해 주세요.");
  }

  return {
    documentTitle: parsed.data.documentTitle ?? undefined,
    sections,
    warnings: parsed.data.warnings,
    aiCall: response.metrics,
  };
}

function buildSystemPrompt(): string {
  return [
    "당신은 학교 평가계획 PDF의 문서 목차 구조만 추출하는 도구입니다.",
    "평가 내용이나 점수, 성취기준 같은 업무 데이터를 새로 만들지 말고 문서에 실제로 있는 제목만 반환하세요.",
    "표의 열 제목, 표 안의 행 이름, 본문 문장, 평가기준 문장, 성취기준 코드는 문서 구조 제목으로 추출하지 마세요.",
    "문서 제목을 최대 7단계의 평면 목록으로 반환하세요.",
    "단계 기준은 level 1=대분류(제목), level 2='1.' 단위, level 3='가.' 단위, level 4='1)' 단위, level 5='가)' 단위, level 6='(1)' 단위, level 7='(가)' 단위입니다.",
    "원문 번호가 일부 생략되거나 다른 큰 제목 표기(예: 로마숫자)를 쓰더라도 문서의 실제 포함 관계를 보고 가장 가까운 단계로 분류하세요.",
    "교과명이 구조 제목 앞에 반복되어 붙어 있으면 의미를 해치지 않는 범위에서 교과명 접두어를 제거하여 학교 공통 양식 제목으로 제안할 수 있습니다.",
    "번호 모양 자체보다 문서의 의미와 배치를 우선하되, 같은 깊이의 제목에는 같은 level을 사용하세요.",
    "제목의 앞쪽 공문서 번호나 로마숫자 표시는 제거하고 사람이 메뉴에서 읽을 제목만 title에 넣으세요.",
    "PAGE 표시는 원문 페이지 경계를 뜻합니다. 각 제목이 처음 나타난 페이지를 pageNumber에 넣으세요.",
    "반드시 원문 순서대로 반환하고 같은 머리글이 페이지마다 반복된 경우 한 번만 남기세요.",
    "반드시 JSON 객체 하나만 반환하세요. 마크다운이나 설명 문장을 붙이지 마세요.",
  ].join("\n");
}

function buildUserPrompt(sourceText: string, headingHints: readonly string[]): string {
  return [
    "응답 JSON 구조:",
    '{"documentTitle":"문서 제목 또는 null","headings":[{"title":"제목","level":1,"pageNumber":1}],"warnings":["사람이 확인할 구조상 모호함"]}',
    "level은 1부터 7까지만 사용하세요. 첫 구조 항목은 level 1이어야 하며 한 번에 두 단계 이상 건너뛰지 마세요.",
    "아래 제목 후보는 정규식으로 먼저 잡은 참고 목록입니다. 후보라고 해서 무조건 제목은 아니며, 본문 문장이나 표 항목이면 제외하세요. 반대로 실제 제목이 후보에 없더라도 원문에서 확인되면 포함하세요.",
    "제목 후보:",
    headingHints.length > 0 ? headingHints.join("\n") : "(후보 없음)",
    "평가계획 원문:",
    sourceText,
  ].join("\n\n");
}

function assignStableImportedIds(
  sections: readonly EvaluationTemplateSection[],
): EvaluationTemplateSection[] {
  const pathByLevel = new Map<EvaluationTemplateSectionLevel, string>();
  const occurrenceByIdentity = new Map<string, number>();

  const inputs = sections.map((section): EvaluationTemplateSectionInput => {
    pathByLevel.set(section.level, normalizeComparableTitle(section.title));
    for (const deeperLevel of [2, 3, 4, 5, 6, 7] as const) {
      if (deeperLevel > section.level) pathByLevel.delete(deeperLevel);
    }

    const identity = [1, 2, 3, 4, 5, 6, 7]
      .filter((level) => level <= section.level)
      .map((level) => pathByLevel.get(level as EvaluationTemplateSectionLevel) ?? "")
      .join(">");
    const occurrence = (occurrenceByIdentity.get(identity) ?? 0) + 1;
    occurrenceByIdentity.set(identity, occurrence);
    const suffix = occurrence === 1 ? "" : `-${occurrence}`;

    return {
      id: `section-${stableHash(identity)}${suffix}`,
      title: section.title,
      level: section.level,
      teacherEditableTitle: section.teacherEditableTitle,
      ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
    };
  });

  return normalizeEvaluationTemplateSections(inputs);
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function collectHeadingHints(pages: readonly ExtractedPdfPage[]): string[] {
  const hints: string[] = [];

  for (const page of pages) {
    for (const rawLine of page.text.split("\n")) {
      const line = rawLine.replace(/\s+/g, " ").trim();
      if (!line || line.length > 140) continue;
      if (!looksLikeHeading(line)) continue;
      hints.push(`p.${page.pageNumber} ${line}`);
      if (hints.length >= MAX_HEADING_HINTS) return hints;
    }
  }

  return hints;
}

function looksLikeHeading(line: string): boolean {
  return (
    /^\d{1,2}\s+\S.{1,100}$/.test(line) ||
    /^\d{1,2}\.\s*\S.{1,100}$/.test(line) ||
    /^[가-힣]\.\s*\S.{1,100}$/.test(line) ||
    /^\d{1,2}\)\s*\S.{1,100}$/.test(line) ||
    /^[가-힣]\)\s*\S.{1,100}$/.test(line) ||
    /^\(\d{1,2}\)\s*\S.{1,100}$/.test(line) ||
    /^\([가-힣]\)\s*\S.{1,100}$/.test(line) ||
    /^[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\s*\S.{1,100}$/.test(line) ||
    /^(?:제\s*)?\d+\s*(?:장|절|항)\s*\S/.test(line) ||
    /(?:평가\s*(?:개요|기준|방법|방침|결과|세부\s*계획)|교수\s*학습.*평가|수행평가\s*세부\s*계획|정기시험\s*세부\s*계획)$/.test(
      line,
    )
  );
}

function removeAdjacentDuplicates(
  headings: readonly EvaluationTemplateSectionInput[],
): EvaluationTemplateSectionInput[] {
  const result: EvaluationTemplateSectionInput[] = [];

  for (const heading of headings) {
    const previous = result[result.length - 1];
    if (
      previous &&
      previous.level === heading.level &&
      normalizeComparableTitle(previous.title) === normalizeComparableTitle(heading.title)
    ) {
      continue;
    }
    result.push(heading);
  }

  return result;
}

function cleanHeadingTitle(value: string): string {
  return value
    .replace(
      /^\s*(?:\(\d{1,2}\)|\([가-힣]\)|\d{1,2}[.)]|[가-힣][.)]|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+|\d{1,2}(?=\s))\s*/,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableTitle(value: string): string {
  return cleanHeadingTitle(value).replace(/\s+/g, "").toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
