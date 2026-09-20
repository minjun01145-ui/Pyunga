import { z } from "zod";

import {
  getEvaluationTemplateIssues,
  normalizeEvaluationTemplateSections,
  type EvaluationTemplate,
  type EvaluationTemplateSectionInput,
} from "../domain/evaluation-template";
import { parseEvaluationTemplateSectionConfig } from "../domain/evaluation-template-section-config";

const sectionSchema = z.object({
  id: z.string().trim().min(1).max(100),
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
  teacherEditableTitle: z.boolean().optional().default(false),
  sourcePage: z.number().int().min(1).max(60).optional(),
  config: z.unknown().optional(),
});

const sourceSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  totalPages: z.number().int().min(1).max(60),
  selectedPages: z.array(z.number().int().min(1).max(60)).max(60),
});

const rawEvaluationTemplateSaveSchema = z.object({
  documentTitle: z.string().trim().min(1).max(200).optional(),
  sections: z.array(sectionSchema).min(1).max(100),
  source: sourceSchema.optional(),
});

const evaluationTemplateSaveRequestSchema = z.object({
  template: z.unknown(),
  expectedRevision: z.number().int().min(0).max(1_000_000_000),
});

export type EvaluationTemplateSaveRequest = {
  template: EvaluationTemplate;
  expectedRevision: number;
};

export function parseEvaluationTemplateSaveRequest(value: unknown): EvaluationTemplateSaveRequest | null {
  const parsed = evaluationTemplateSaveRequestSchema.safeParse(value);
  if (parsed.success) {
    const template = parseEvaluationTemplateSaveInput(parsed.data.template);
    return template
      ? { template, expectedRevision: parsed.data.expectedRevision }
      : null;
  }

  const legacyTemplate = parseEvaluationTemplateSaveInput(value);
  return legacyTemplate
    ? { template: legacyTemplate, expectedRevision: 0 }
    : null;
}

export function parseEvaluationTemplateSaveInput(value: unknown): EvaluationTemplate | null {
  const parsed = rawEvaluationTemplateSaveSchema.safeParse(value);
  if (!parsed.success) return null;

  const inputs: EvaluationTemplateSectionInput[] = [];
  for (const section of parsed.data.sections) {
    const config = section.config === undefined ? undefined : parseEvaluationTemplateSectionConfig(section.config);
    if (section.config !== undefined && !config) return null;
    inputs.push({
      id: section.id,
      title: section.title,
      level: section.level,
      teacherEditableTitle: section.teacherEditableTitle,
      ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
      ...(config ? { config } : {}),
    });
  }

  const template: EvaluationTemplate = {
    documentTitle: parsed.data.documentTitle,
    sections: normalizeEvaluationTemplateSections(inputs),
    source: parsed.data.source,
  };

  return getEvaluationTemplateIssues(template).length === 0 ? template : null;
}
