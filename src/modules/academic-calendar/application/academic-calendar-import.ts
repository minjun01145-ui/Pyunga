import { z } from "zod";

import type { AiJsonClient } from "../../ai-review";
import type {
  AcademicCalendarEventType,
  AcademicSemester,
  SchoolGrade,
  WrittenExamKind,
} from "../domain/academic-calendar-event";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealIsoDate, "실제 존재하는 날짜여야 합니다.");

const schoolGradeSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

const aiEventSchema = z.object({
  title: z.string().trim().min(1).max(120),
  type: z.enum(["written_exam", "school_event", "vacation", "other"]),
  semester: z.union([z.literal(1), z.literal(2)]),
  startDate: isoDateSchema,
  endDate: isoDateSchema.nullable().optional(),
  targetGrades: z.array(schoolGradeSchema).max(3).default([]),
  writtenExamKind: z.enum(["midterm", "final", "other"]).nullable().optional(),
  sourceText: z.string().trim().min(1).max(300),
});

const aiImportResponseSchema = z.object({
  documentTitle: z.string().trim().min(1).max(200).nullable().optional(),
  events: z.array(aiEventSchema).max(500),
  warnings: z.array(z.string().trim().min(1).max(300)).max(30).default([]),
});

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
};

export type AcademicCalendarSourceSelection = {
  text: string;
  pageNumbers: number[];
};

export type AcademicCalendarImportCandidate = {
  academicYear: number;
  title: string;
  type: AcademicCalendarEventType;
  semester: AcademicSemester;
  startDate: string;
  endDate?: string;
  targetGrades: SchoolGrade[];
  writtenExamKind?: WrittenExamKind;
  sourceText: string;
  issues: string[];
};

export type AcademicCalendarImportResult = {
  documentTitle?: string;
  events: AcademicCalendarImportCandidate[];
  warnings: string[];
};

const CALENDAR_PAGE_KEYWORDS = [
  /학사\s*일정/,
  /교육\s*일정/,
  /중간\s*고사/,
  /기말\s*고사/,
  /정기\s*고사/,
  /시업식/,
  /입학식/,
  /종업식/,
  /졸업식/,
  /방학/,
  /개교기념일/,
  /재량\s*휴업/,
  /주요\s*교육\s*활동/,
  /수업\s*일수/,
  /학급회/,
  /동아리/,
  /영어\s*듣기/,
  /예방\s*교육/,
] as const;

const MAX_SOURCE_PAGES = 20;
const MAX_SOURCE_CHARACTERS = 100_000;

export class AcademicCalendarImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicCalendarImportError";
  }
}

export function selectAcademicCalendarSourceText(
  pages: readonly ExtractedPdfPage[],
): AcademicCalendarSourceSelection {
  const normalizedPages = pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: normalizeWhitespace(page.text),
  }));

  const matchingIndexes = normalizedPages
    .map((page, index) => (CALENDAR_PAGE_KEYWORDS.some((keyword) => keyword.test(page.text)) ? index : -1))
    .filter((index) => index >= 0);

  if (matchingIndexes.length === 0) {
    if (normalizedPages.length > MAX_SOURCE_PAGES) {
      throw new AcademicCalendarImportError(
        "학사일정 관련 페이지를 찾지 못했습니다. 학사일정 표가 포함된 PDF인지 확인해 주세요.",
      );
    }

    return buildSourceSelection(normalizedPages);
  }

  const selectedIndexes = new Set<number>();
  for (const index of matchingIndexes) {
    selectedIndexes.add(index);
    if (index > 0) selectedIndexes.add(index - 1);
    if (index + 1 < normalizedPages.length) selectedIndexes.add(index + 1);
  }

  const selectedPages = [...selectedIndexes]
    .sort((left, right) => left - right)
    .slice(0, MAX_SOURCE_PAGES)
    .map((index) => normalizedPages[index]);

  return buildSourceSelection(selectedPages);
}

export async function importAcademicCalendarFromText(params: {
  academicYear: number;
  sourceText: string;
  aiClient: AiJsonClient;
}): Promise<AcademicCalendarImportResult> {
  validateAcademicYear(params.academicYear);

  if (params.sourceText.trim().length < 20) {
    throw new AcademicCalendarImportError("학사일정을 분석할 수 있는 문서 텍스트가 충분하지 않습니다.");
  }

  const response = await params.aiClient.generateJson({
    temperature: 0,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(),
      },
      {
        role: "user",
        content: buildUserPrompt(params.academicYear, params.sourceText),
      },
    ],
  });

  const parsed = aiImportResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new AcademicCalendarImportError("AI 응답 형식이 학사일정 스키마와 맞지 않습니다. 다시 분석해 주세요.");
  }

  const events = deduplicateCandidates(
    parsed.data.events.map((event) => normalizeCandidate(params.academicYear, event)),
  ).sort((left, right) => left.startDate.localeCompare(right.startDate));

  return {
    documentTitle: parsed.data.documentTitle ?? undefined,
    events,
    warnings: parsed.data.warnings,
  };
}

function buildSystemPrompt(): string {
  return [
    "당신은 대한민국 중학교의 교육계획서/학사일정 문서에 공식적으로 기록된 일정을 구조화하는 도구입니다.",
    "중요도를 판단해서 일정을 생략하지 마세요. 학사일정 표 또는 주요교육활동에 일정으로 명시된 항목은 모두 추출하는 것이 원칙입니다.",
    "학급회, 동아리, 각종 예방교육, 영어듣기평가, 표준화검사, 학생회·학급 임원 선거, 학부모 행사, 체험학습, 진로활동, 문화예술행사, 체육행사, 봉사활동 등 반복되거나 규모가 작은 교육활동도 제외하지 마세요.",
    "공휴일, 대체공휴일, 재량휴업일, 개교기념일처럼 수업 여부에 영향을 주는 날도 문서에 표시되어 있으면 추출하세요.",
    "원문에 명시된 사실만 추출하고 날짜, 학년, 행사 종류를 추정하거나 만들어내지 마세요.",
    "반드시 JSON 객체 하나만 반환하세요. 마크다운 코드블록이나 설명 문장을 붙이지 마세요.",
    "중간고사와 기말고사는 반드시 written_exam으로 분류하고 대상 학년을 targetGrades에 넣으세요.",
    "같은 시험이나 같은 행사가 연속된 여러 날짜에 진행되면 의미상 하나의 일정인 경우 startDate와 endDate로 합치세요.",
    "시험이 아닌 교육활동과 학교 행사는 school_event로 분류하세요. 방학 기간은 vacation으로 분류하세요. 공휴일·휴업일 등 나머지 일정은 other로 분류할 수 있습니다.",
    "같은 일정이 날짜 칸과 주요교육활동 요약에 중복 기재된 경우 한 번만 반환하되, 서로 다른 날짜의 반복 일정은 각각 별도 일정으로 남기세요.",
    "sourceText에는 일정명, 날짜, 대상 학년, 시간 정보 등 해당 일정의 근거가 보이도록 원문 일부를 짧게 넣으세요.",
  ].join("\n");
}

function buildUserPrompt(academicYear: number, sourceText: string): string {
  const followingYear = academicYear + 1;

  return [
    `학년도: ${academicYear}학년도`,
    `날짜 해석 규칙: ${academicYear}년 3월부터 12월까지는 ${academicYear}년, 1월과 2월은 ${followingYear}년으로 해석하세요. 원문에 연도가 명시되어 있으면 원문을 우선하세요.`,
    "1학기/2학기 표 제목이 있으면 그 구분을 semester 1 또는 2로 그대로 사용하세요.",
    "응답 JSON 구조:",
    '{"documentTitle":"문서 제목 또는 null","events":[{"title":"일정명","type":"written_exam|school_event|vacation|other","semester":1,"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD 또는 null","targetGrades":[1,2,3],"writtenExamKind":"midterm|final|other 또는 null","sourceText":"근거 원문"}],"warnings":["원문이 모호해 사람이 확인해야 할 사항"]}',
    "written_exam이 아닌 일정은 writtenExamKind를 null로 두세요. 대상 학년이 명시되지 않은 일정은 targetGrades를 빈 배열로 두세요.",
    "일정의 중요도를 임의로 평가하지 말고, 문서에 학사일정으로 기재된 모든 항목을 events에 포함하세요.",
    "문서:",
    sourceText,
  ].join("\n\n");
}

function normalizeCandidate(
  academicYear: number,
  event: z.infer<typeof aiEventSchema>,
): AcademicCalendarImportCandidate {
  const issues: string[] = [];
  const endDate = event.endDate ?? undefined;
  const targetGrades = [...new Set(event.targetGrades)].sort((left, right) => left - right) as SchoolGrade[];

  const academicYearStart = `${academicYear}-03-01`;
  const academicYearEnd = `${academicYear + 1}-03-01`;

  if (event.startDate < academicYearStart || event.startDate > academicYearEnd) {
    issues.push("시작일이 선택한 학년도 범위를 벗어납니다.");
  }

  if (endDate && endDate < event.startDate) {
    issues.push("종료일이 시작일보다 빠릅니다.");
  }

  if (endDate && (endDate < academicYearStart || endDate > academicYearEnd)) {
    issues.push("종료일이 선택한 학년도 범위를 벗어납니다.");
  }

  if (event.type === "written_exam" && targetGrades.length === 0) {
    issues.push("시험 대상 학년을 원문에서 확인해야 합니다.");
  }

  if (event.type === "written_exam" && !event.writtenExamKind) {
    issues.push("중간/기말고사 구분을 확인해야 합니다.");
  }

  return {
    academicYear,
    title: event.title,
    type: event.type,
    semester: event.semester,
    startDate: event.startDate,
    endDate,
    targetGrades,
    writtenExamKind: event.type === "written_exam" ? event.writtenExamKind ?? undefined : undefined,
    sourceText: normalizeWhitespace(event.sourceText),
    issues,
  };
}

function deduplicateCandidates(
  candidates: readonly AcademicCalendarImportCandidate[],
): AcademicCalendarImportCandidate[] {
  const unique = new Map<string, AcademicCalendarImportCandidate>();

  for (const candidate of candidates) {
    const key = [
      candidate.type,
      candidate.title,
      candidate.startDate,
      candidate.endDate ?? "",
      candidate.targetGrades.join(","),
    ].join("|");

    if (!unique.has(key)) {
      unique.set(key, candidate);
    }
  }

  return [...unique.values()];
}

function buildSourceSelection(pages: readonly ExtractedPdfPage[]): AcademicCalendarSourceSelection {
  const selected: ExtractedPdfPage[] = [];
  let characterCount = 0;

  for (const page of pages) {
    const section = `--- PAGE ${page.pageNumber} ---\n${page.text}`;
    if (section.length > MAX_SOURCE_CHARACTERS) {
      throw new AcademicCalendarImportError("학사일정 페이지의 텍스트가 너무 커서 분석할 수 없습니다.");
    }

    if (characterCount + section.length > MAX_SOURCE_CHARACTERS) {
      break;
    }

    selected.push(page);
    characterCount += section.length;
  }

  if (selected.length === 0) {
    throw new AcademicCalendarImportError("학사일정 문서에서 읽을 수 있는 텍스트를 찾지 못했습니다.");
  }

  return {
    text: selected.map((page) => `--- PAGE ${page.pageNumber} ---\n${page.text}`).join("\n\n"),
    pageNumbers: selected.map((page) => page.pageNumber),
  };
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function validateAcademicYear(academicYear: number): void {
  if (!Number.isInteger(academicYear) || academicYear < 2000 || academicYear > 2100) {
    throw new AcademicCalendarImportError("학년도 값이 올바르지 않습니다.");
  }
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
