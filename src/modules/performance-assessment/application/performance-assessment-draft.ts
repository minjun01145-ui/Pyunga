import { z } from "zod";

import { validatePerformanceAssessment } from "../domain/validation";

const idSchema = z.string().trim().min(1).max(128);
const scoreSchema = z.number().finite().min(0).max(10_000);
const levelSchema = z.object({
  id: idSchema,
  label: z.string().max(80),
  description: z.string().max(2_000),
  score: scoreSchema,
});
const scoringModelSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("level_table"), levels: z.array(levelSchema).max(100) }),
  z.object({
    type: z.literal("threshold_table"),
    metricLabel: z.string().max(80),
    rows: z.array(z.object({
      id: idSchema,
      conditionLabel: z.string().max(300),
      score: scoreSchema,
    })).max(100),
  }),
  z.object({
    type: z.literal("criterion_count"),
    criteria: z.array(z.object({ id: idSchema, description: z.string().max(1_000) })).max(100),
    scoreBySatisfiedCount: z.array(z.object({
      id: idSchema,
      satisfiedCount: z.number().int().min(0).max(100),
      score: scoreSchema,
    })).max(101),
  }),
  z.object({
    type: z.literal("additive_rubric"),
    items: z.array(z.object({
      id: idSchema,
      label: z.string().max(100),
      maxScore: scoreSchema,
      levels: z.array(z.object({
        id: idSchema,
        description: z.string().max(2_000),
        score: scoreSchema,
      })).max(100),
    })).max(100),
  }),
  z.object({
    type: z.literal("custom_table"),
    columns: z.array(z.object({ id: idSchema, label: z.string().max(100) })).max(30),
    rows: z.array(z.record(z.string().max(128), z.string().max(2_000))).max(200),
  }),
]);

export const performanceAssessmentDraftSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(120),
  weightPercent: z.number().finite().min(0).max(100),
  maxScore: scoreSchema,
  achievementStandardIds: z.array(idSchema).max(100),
  sections: z.array(z.object({
    id: idSchema,
    title: z.string().trim().min(1).max(120),
    maxScore: scoreSchema,
    scoringModel: scoringModelSchema,
  })).max(100),
  wholeAssessmentScoringModel: scoringModelSchema.optional(),
}).superRefine((assessment, context) => {
  for (const error of validatePerformanceAssessment(assessment)) {
    context.addIssue({ code: "custom", message: error.code });
  }
});
