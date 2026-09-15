import type { EvaluationPlan } from "./evaluation-plan";

export type EvaluationPlanValidationError =
  | { code: "TOTAL_WEIGHT_NOT_100"; actual: number }
  | { code: "NEGATIVE_WEIGHT" };

export function calculateTotalWeightPercent(plan: EvaluationPlan): number {
  const writtenTotal = plan.writtenAssessments.reduce(
    (sum, assessment) => sum + assessment.weightPercent,
    0,
  );

  const performanceTotal = plan.performanceAssessments.reduce(
    (sum, assessment) => sum + assessment.weightPercent,
    0,
  );

  return writtenTotal + performanceTotal;
}

export function validateEvaluationPlan(plan: EvaluationPlan): EvaluationPlanValidationError[] {
  const errors: EvaluationPlanValidationError[] = [];
  const allWeights = [
    ...plan.writtenAssessments.map((item) => item.weightPercent),
    ...plan.performanceAssessments.map((item) => item.weightPercent),
  ];

  if (allWeights.some((weight) => weight < 0)) {
    errors.push({ code: "NEGATIVE_WEIGHT" });
  }

  const total = calculateTotalWeightPercent(plan);
  if (total !== 100) {
    errors.push({ code: "TOTAL_WEIGHT_NOT_100", actual: total });
  }

  return errors;
}
