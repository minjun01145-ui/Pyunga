import { z } from "zod";

import type { AcademicCalendarEvent } from "@/modules/academic-calendar";
import {
  getEvaluationTemplateSectionConfigIssues,
  type EvaluationTemplate,
  type TableTemplateDocument,
  type TableTemplateInputKind,
} from "@/modules/template";
import type { TeacherEvaluationContext } from "./teacher-evaluation-context";
import { buildTeachingLearningCalendarRows } from "./teaching-learning-calendar";

export type EvaluationPlanDraftFieldValue = string | string[];

export type EvaluationPlanDraftSection = {
  title?: string;
  body?: string;
  fields: Record<string, EvaluationPlanDraftFieldValue>;
  rows?: Record<string, { fields: Record<string, EvaluationPlanDraftFieldValue> }>;
};

export type EvaluationPlanDraft = {
  academicYear: string;
  semester: "" | "1" | "2";
  grade: "" | "1" | "2" | "3";
  subjectLabel: string;
  sections: Record<string, EvaluationPlanDraftSection>;
};

export type EvaluationPlanDraftTemplateIssue = {
  sectionId: string;
  fieldKey: string;
  message: string;
};

const sectionKeySchema = z.string().trim().min(1).max(100);
const fieldKeySchema = z.string().trim().min(1).max(100);
const fieldValueSchema = z.union([
  z.string().max(10_000),
  z.array(z.string().max(2_000)).max(100),
]);

const draftSectionSchema = z.object({
  title: z.string().max(120).optional(),
  body: z.string().max(30_000).optional(),
  fields: z.record(fieldKeySchema, fieldValueSchema),
  rows: z.record(
    z.string().trim().min(1).max(100),
    z.object({ fields: z.record(fieldKeySchema, fieldValueSchema) }),
  ).optional(),
});

export const evaluationPlanDraftSchema = z.object({
  academicYear: z.string().regex(/^\d{0,4}$/),
  semester: z.enum(["", "1", "2"]),
  grade: z.enum(["", "1", "2", "3"]),
  subjectLabel: z.string().max(80),
  sections: z.record(sectionKeySchema, draftSectionSchema),
}).superRefine((draft, context) => {
  if (Object.keys(draft.sections).length > 100) {
    context.addIssue({ code: "custom", message: "SECTION_COUNT_EXCEEDED" });
  }

  for (const section of Object.values(draft.sections)) {
    if (Object.keys(section.fields).length > 60) {
      context.addIssue({ code: "custom", message: "FIELD_COUNT_EXCEEDED" });
      break;
    }
    if (section.rows && Object.keys(section.rows).length > 80) {
      context.addIssue({ code: "custom", message: "ROW_COUNT_EXCEEDED" });
      break;
    }
    if (section.rows && Object.values(section.rows).some((row) => Object.keys(row.fields).length > 60)) {
      context.addIssue({ code: "custom", message: "ROW_FIELD_COUNT_EXCEEDED" });
      break;
    }
  }
});

export function createEmptyEvaluationPlanDraft(
  context?: TeacherEvaluationContext,
): EvaluationPlanDraft {
  return {
    academicYear: context ? String(context.academicYear) : "",
    semester: context ? String(context.semester) as "1" | "2" : "",
    grade: context ? String(context.grade) as "1" | "2" | "3" : "",
    subjectLabel: context?.subjectLabel ?? "",
    sections: {},
  };
}

export function applyTeacherEvaluationContext(
  draft: EvaluationPlanDraft,
  context: TeacherEvaluationContext,
): EvaluationPlanDraft {
  return {
    ...draft,
    academicYear: String(context.academicYear),
    semester: String(context.semester) as "1" | "2",
    grade: String(context.grade) as "1" | "2" | "3",
    subjectLabel: context.subjectLabel,
  };
}

export function parseEvaluationPlanDraft(value: unknown): EvaluationPlanDraft | null {
  const parsed = evaluationPlanDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getEvaluationPlanDraftTemplateIssues(
  template: EvaluationTemplate,
  draft: EvaluationPlanDraft,
  options?: {
    teacherContext: TeacherEvaluationContext;
    calendarEvents: readonly AcademicCalendarEvent[];
  },
): EvaluationPlanDraftTemplateIssue[] {
  const issues: EvaluationPlanDraftTemplateIssue[] = [];

  for (const section of template.sections) {
    if (!section.config) {
      issues.push({
        sectionId: section.id,
        fieldKey: "__section_config__",
        message: `${section.title}의 입력 양식이 평가계에서 아직 설정되지 않았습니다.`,
      });
      continue;
    }
    const configIssues = getEvaluationTemplateSectionConfigIssues(section.config);
    if (configIssues.length > 0) {
      for (const configIssue of configIssues) {
        issues.push({
          sectionId: section.id,
          fieldKey: "__section_config__",
          message: `${section.title}: ${configIssue}`,
        });
      }
      continue;
    }
    if (section.config.type === "title_only" || section.config.type === "outline_text") continue;
    const draftSection = draft.sections[section.id];

    if (
      section.config.type === "teaching_learning_table"
      && section.config.calendarRows.enabled
      && options
    ) {
      const calendarRows = buildTeachingLearningCalendarRows(
        section.config,
        options.calendarEvents,
        options.teacherContext,
      );
      if (calendarRows.length === 0) {
        issues.push({
          sectionId: section.id,
          fieldKey: "__academic_calendar__",
          message: `${section.title}: 해당 학기·학년에 적용할 학사일정이 없어 자동 행을 만들 수 없습니다.`,
        });
        continue;
      }
      for (const calendarRow of calendarRows) {
        addTableValueIssues({
          issues,
          sectionId: section.id,
          sectionTitle: section.title,
          table: section.config.table,
          values: draftSection?.rows?.[calendarRow.key]?.fields ?? {},
          rowLabel: calendarRow.period.label,
          skipSystemFields: true,
        });
      }
      continue;
    }

    addTableValueIssues({
      issues,
      sectionId: section.id,
      sectionTitle: section.title,
      table: section.config.table,
      values: draftSection?.fields ?? {},
      skipSystemFields: true,
    });
  }

  return issues;
}

function addTableValueIssues(params: {
  issues: EvaluationPlanDraftTemplateIssue[];
  sectionId: string;
  sectionTitle: string;
  table: TableTemplateDocument;
  values: Record<string, EvaluationPlanDraftFieldValue>;
  rowLabel?: string;
  skipSystemFields: boolean;
}): void {
  for (const row of params.table.content[0].content) {
    for (const cell of row.content) {
      const fieldKey = cell.attrs.fieldKey;
      if (!fieldKey || (params.skipSystemFields && cell.attrs.inputSource === "system")) continue;
      const value = params.values[fieldKey];
      const label = cell.attrs.fieldLabel || fieldKey;
      const location = params.rowLabel
        ? `${params.sectionTitle} ${params.rowLabel}`
        : params.sectionTitle;

      if (cell.attrs.required && !hasDraftFieldValue(value)) {
        params.issues.push({
          sectionId: params.sectionId,
          fieldKey,
          message: `${location}의 '${label}' 항목을 입력해 주세요.`,
        });
        continue;
      }
      if (!hasDraftFieldValue(value)) continue;

      const kindIssue = validateFieldKind(value, cell.attrs.inputKind ?? "text", label, location);
      if (kindIssue) {
        params.issues.push({ sectionId: params.sectionId, fieldKey, message: kindIssue });
      }
    }
  }
}

export function getEvaluationPlanTemplateSignature(
  template: EvaluationTemplate,
  context?: TeacherEvaluationContext,
): string {
  const canonical = stableSerialize({
    context: context ?? null,
    documentTitle: template.documentTitle ?? "",
    sections: template.sections.map((section) => ({
      id: section.id,
      title: section.title,
      level: section.level,
      teacherEditableTitle: section.teacherEditableTitle,
      order: section.order,
      parentId: section.parentId ?? "",
      config: section.config ?? null,
    })),
  });

  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(",")}}`;
}

function hasDraftFieldValue(value: EvaluationPlanDraftFieldValue | undefined): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((item) => item.trim().length > 0);
  return false;
}

function validateFieldKind(
  value: EvaluationPlanDraftFieldValue,
  kind: TableTemplateInputKind,
  label: string,
  sectionTitle: string,
): string | null {
  if (kind === "bullet_list" || kind === "checkbox_list") {
    return Array.isArray(value)
      ? null
      : `${sectionTitle}의 '${label}' 항목은 목록 형식으로 입력해 주세요.`;
  }

  if (Array.isArray(value)) {
    return `${sectionTitle}의 '${label}' 항목 입력 형식이 양식과 맞지 않습니다.`;
  }

  if (kind === "number" || kind === "percentage") {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return `${sectionTitle}의 '${label}' 항목은 숫자로 입력해 주세요.`;
    }
    if (kind === "percentage" && (numericValue < 0 || numericValue > 100)) {
      return `${sectionTitle}의 '${label}' 항목은 0 이상 100 이하로 입력해 주세요.`;
    }
  }

  return null;
}
