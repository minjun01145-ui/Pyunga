import { z } from "zod";

import type {
  EvaluationTemplate,
  TableTemplateInputKind,
} from "@/modules/template";

export type EvaluationPlanDraftFieldValue = string | string[];

export type EvaluationPlanDraftSection = {
  title?: string;
  body?: string;
  fields: Record<string, EvaluationPlanDraftFieldValue>;
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
  }
});

export function createEmptyEvaluationPlanDraft(): EvaluationPlanDraft {
  return {
    academicYear: "",
    semester: "",
    grade: "",
    subjectLabel: "",
    sections: {},
  };
}

export function parseEvaluationPlanDraft(value: unknown): EvaluationPlanDraft | null {
  const parsed = evaluationPlanDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getEvaluationPlanDraftTemplateIssues(
  template: EvaluationTemplate,
  draft: EvaluationPlanDraft,
): EvaluationPlanDraftTemplateIssue[] {
  const issues: EvaluationPlanDraftTemplateIssue[] = [];

  for (const section of template.sections) {
    if (!section.config || section.config.type === "outline_text") continue;
    const values = draft.sections[section.id]?.fields ?? {};

    for (const row of section.config.table.content[0].content) {
      for (const cell of row.content) {
        const fieldKey = cell.attrs.fieldKey;
        if (!fieldKey) continue;
        const value = values[fieldKey];
        const label = cell.attrs.fieldLabel || fieldKey;

        if (cell.attrs.required && !hasDraftFieldValue(value)) {
          issues.push({
            sectionId: section.id,
            fieldKey,
            message: `${section.title}의 '${label}' 항목을 입력해 주세요.`,
          });
          continue;
        }
        if (!hasDraftFieldValue(value)) continue;

        const kindIssue = validateFieldKind(value, cell.attrs.inputKind ?? "text", label, section.title);
        if (kindIssue) {
          issues.push({ sectionId: section.id, fieldKey, message: kindIssue });
        }
      }
    }
  }

  return issues;
}

export function getEvaluationPlanTemplateSignature(template: EvaluationTemplate): string {
  const canonical = stableSerialize({
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
