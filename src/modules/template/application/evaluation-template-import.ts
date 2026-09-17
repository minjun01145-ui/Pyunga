import { z } from "zod";

import type { ExtractedPdfPage } from "@/shared/pdf/pdf-text-extractor";
import type { AiCallMetrics, AiJsonClient } from "../../ai-review";
import {
  normalizeEvaluationTemplateSections,
  type EvaluationTemplate,
  type EvaluationTemplateChildrenMode,
  type EvaluationTemplateSection,
  type EvaluationTemplateSectionInput,
} from "../domain/evaluation-template";

const aiHeadingSchema = z.object({
  title: z.string().trim().min(1).max(120),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  childrenMode: z.enum(["fixed", "repeatable"]).default("fixed"),
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

export type EvaluationTemplateRepeatableItemSample = {
  parentSectionId: string;
  title: string;
  sourcePage?: number;
};

export type EvaluationTemplateImportResult = EvaluationTemplate & {
  repeatableItemSamples: EvaluationTemplateRepeatableItemSample[];
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
      childrenMode: resolveChildrenMode(heading.title, heading.level, heading.childrenMode),
      ...(heading.pageNumber ? { sourcePage: heading.pageNumber } : {}),
    })),
  ).map((heading, index) => ({ ...heading, id: `section-${index + 1}` }));

  const analyzedSections = assignStableImportedIds(normalizeEvaluationTemplateSections(inputs));
  if (analyzedSections.filter((section) => section.level === 1).length === 0) {
    throw new EvaluationTemplateImportError("문서에서 대분류를 찾지 못했습니다. 분석 결과를 다시 확인해 주세요.");
  }

  const { sections, repeatableItemSamples } = separateRepeatableItems(analyzedSections);

  return {
    documentTitle: parsed.data.documentTitle ?? undefined,
    sections,
    repeatableItemSamples,
    warnings: parsed.data.warnings,
    aiCall: response.metrics,
  };
}

function buildSystemPrompt(): string {
  return [
    "당신은 학교 평가계획 PDF의 문서 목차 구조만 추출하는 도구입니다.",
    "평가 내용이나 점수, 성취기준 같은 업무 데이터를 새로 만들지 말고 문서에 실제로 있는 제목만 반환하세요.",
    "표의 열 제목, 표 안의 행 이름, 본문 문장, 평가기준 문장, 성취기준 코드는 문서 구조 제목으로 추출하지 마세요.",
    "문서 전체를 대분류(level 1), 그 아래 구분을 중분류(level 2), 중분류 아래의 실제 제목을 소분류(level 3)까지 평면 목록으로 반환하세요.",
    "각 제목에는 childrenMode를 지정하세요. 모든 교과가 공통으로 같은 하위 제목을 사용하는 구조이면 fixed입니다.",
    "하위 제목의 이름과 개수가 교과마다 달라지는 실제 평가 항목 목록을 담는 영역이면 repeatable입니다.",
    "대표적으로 수행평가 세부계획 아래의 '영어듣기평가', '말하기', '실험', '프로젝트' 같은 개별 수행평가명은 학교 공통 Template 제목이 아니라 교과별 반복 데이터입니다. 이 경우 부모인 수행평가 세부계획을 repeatable로 표시하고, 개별 평가명도 원문 확인용 heading으로 반환하세요.",
    "반대로 평가 기준 아래의 '기준 성취율과 성취도', '학기단위 성취수준'처럼 여러 교과에서 문서 구조로 반복되는 제목은 fixed 구조로 취급하세요.",
    "교과명이 구조 제목 앞에 반복되어 붙어 있으면 의미를 해치지 않는 범위에서 교과명 접두어를 제거하여 학교 공통 양식 제목으로 제안할 수 있습니다.",
    "번호 모양 자체보다 문서의 의미와 배치를 우선하세요. 예를 들어 큰 숫자 제목 아래 로마숫자 제목, 그 아래 1. 2. 3. 제목이 이어질 수 있습니다.",
    "제목의 앞쪽 번호나 로마숫자 표시는 제거하고 사람이 메뉴에서 읽을 제목만 title에 넣으세요.",
    "PAGE 표시는 원문 페이지 경계를 뜻합니다. 각 제목이 처음 나타난 페이지를 pageNumber에 넣으세요.",
    "반드시 원문 순서대로 반환하고 같은 머리글이 페이지마다 반복된 경우 한 번만 남기세요.",
    "반드시 JSON 객체 하나만 반환하세요. 마크다운이나 설명 문장을 붙이지 마세요.",
  ].join("\n");
}

function buildUserPrompt(sourceText: string, headingHints: readonly string[]): string {
  return [
    "응답 JSON 구조:",
    '{"documentTitle":"문서 제목 또는 null","headings":[{"title":"제목","level":1,"childrenMode":"fixed|repeatable","pageNumber":1}],"warnings":["사람이 확인할 구조상 모호함"]}',
    "level은 1, 2, 3만 사용하세요. 첫 구조 항목은 level 1이어야 하며 한 번에 두 단계 이상 건너뛰지 마세요.",
    "소분류(level 3)는 더 아래 항목을 가질 수 없으므로 childrenMode는 fixed로 두세요.",
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
  const pathByLevel = new Map<1 | 2 | 3, string>();
  const occurrenceByIdentity = new Map<string, number>();

  const inputs = sections.map((section): EvaluationTemplateSectionInput => {
    pathByLevel.set(section.level, normalizeComparableTitle(section.title));
    for (const deeperLevel of [2, 3] as const) {
      if (deeperLevel > section.level) pathByLevel.delete(deeperLevel);
    }

    const identity = [1, 2, 3]
      .filter((level) => level <= section.level)
      .map((level) => pathByLevel.get(level as 1 | 2 | 3) ?? "")
      .join(">");
    const occurrence = (occurrenceByIdentity.get(identity) ?? 0) + 1;
    occurrenceByIdentity.set(identity, occurrence);
    const suffix = occurrence === 1 ? "" : `-${occurrence}`;

    return {
      id: `section-${stableHash(identity)}${suffix}`,
      title: section.title,
      level: section.level,
      childrenMode: section.childrenMode,
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

function separateRepeatableItems(sections: readonly EvaluationTemplateSection[]): {
  sections: EvaluationTemplateSection[];
  repeatableItemSamples: EvaluationTemplateRepeatableItemSample[];
} {
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const repeatableAncestorBySectionId = new Map<string, EvaluationTemplateSection>();

  for (const section of sections) {
    let parentId = section.parentId;
    while (parentId) {
      const parent = sectionById.get(parentId);
      if (!parent) break;
      if (parent.childrenMode === "repeatable") {
        repeatableAncestorBySectionId.set(section.id, parent);
        break;
      }
      parentId = parent.parentId;
    }
  }

  const repeatableItemSamples = sections.flatMap((section) => {
    const repeatableParent = repeatableAncestorBySectionId.get(section.id);
    if (!repeatableParent || section.parentId !== repeatableParent.id) return [];
    return [{
      parentSectionId: repeatableParent.id,
      title: section.title,
      ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
    }];
  });

  const retainedInputs: EvaluationTemplateSectionInput[] = sections
    .filter((section) => !repeatableAncestorBySectionId.has(section.id))
    .map((section) => ({
      id: section.id,
      title: section.title,
      level: section.level,
      childrenMode: section.childrenMode,
      ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
    }));

  return {
    sections: normalizeEvaluationTemplateSections(retainedInputs),
    repeatableItemSamples,
  };
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
    /^\d{1,2}[.)]\s*\S.{1,100}$/.test(line) ||
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

function resolveChildrenMode(
  title: string,
  level: 1 | 2 | 3,
  aiMode: EvaluationTemplateChildrenMode,
): EvaluationTemplateChildrenMode {
  if (level === 3) return "fixed";
  if (aiMode === "repeatable") return "repeatable";
  return isPerformanceAssessmentContainer(title) ? "repeatable" : "fixed";
}

function isPerformanceAssessmentContainer(value: string): boolean {
  const normalized = cleanHeadingTitle(value).replace(/\s+/g, "");
  return normalized.includes("수행평가") && (normalized.includes("세부계획") || normalized.endsWith("계획"));
}

function cleanHeadingTitle(value: string): string {
  return value
    .replace(/^\s*(?:\d{1,2}[.)]?|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+)\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableTitle(value: string): string {
  return cleanHeadingTitle(value).replace(/\s+/g, "").toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
