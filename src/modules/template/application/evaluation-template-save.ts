import { z } from "zod";

import {
  getEvaluationTemplateIssues,
  normalizeEvaluationTemplateSections,
  type EvaluationTemplate,
  type EvaluationTemplateSectionInput,
} from "../domain/evaluation-template";

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
  sourcePage: z.number().int().min(1).max(60).optional(),
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

export function parseEvaluationTemplateSaveInput(value: unknown): EvaluationTemplate | null {
  const parsed = rawEvaluationTemplateSaveSchema.safeParse(value);
  if (!parsed.success) return null;

  const inputs: EvaluationTemplateSectionInput[] = parsed.data.sections.map((section) => ({
    id: section.id,
    title: section.title,
    level: section.level,
    ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
  }));

  const template: EvaluationTemplate = {
    documentTitle: parsed.data.documentTitle,
    sections: normalizeEvaluationTemplateSections(inputs),
    source: parsed.data.source,
  };

  return getEvaluationTemplateIssues(template).length === 0 ? template : null;
}
