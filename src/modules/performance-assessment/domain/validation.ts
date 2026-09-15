import type { EvaluationSection, PerformanceAssessment } from "./performance-assessment";
import { validateScoringModel, type ScoringModelValidationError } from "./scoring-model-validation";

export type PerformanceValidationError =
  | { code: "NEGATIVE_WEIGHT" }
  | { code: "WEIGHT_OVER_100" }
  | { code: "NEGATIVE_MAX_SCORE" }
  | { code: "SECTION_SCORE_EXCEEDS_ASSESSMENT"; sectionId: string }
  | { code: "SECTION_TOTAL_MISMATCH"; actual: number; expected: number }
  | { code: "MISSING_SCORING_STRUCTURE" }
  | { code: "AMBIGUOUS_SCORING_STRUCTURE" }
  | { code: "SCORING_MODEL_ERROR"; targetId: string; error: ScoringModelValidationError };

export function calculateSectionMaxScore(sections: EvaluationSection[]): number {
  return sections.reduce((sum, section) => sum + section.maxScore, 0);
}

export function validatePerformanceAssessment(
  assessment: PerformanceAssessment,
): PerformanceValidationError[] {
  const errors: PerformanceValidationError[] = [];

  if (assessment.weightPercent < 0) {
    errors.push({ code: "NEGATIVE_WEIGHT" });
  }

  if (assessment.weightPercent > 100) {
    errors.push({ code: "WEIGHT_OVER_100" });
  }

  if (assessment.maxScore < 0) {
    errors.push({ code: "NEGATIVE_MAX_SCORE" });
  }

  const hasSections = assessment.sections.length > 0;
  const wholeModel = assessment.wholeAssessmentScoringModel;
  const hasWholeModel = wholeModel !== undefined;

  if (hasSections && hasWholeModel) {
    errors.push({ code: "AMBIGUOUS_SCORING_STRUCTURE" });
  }

  if (!hasSections && !hasWholeModel) {
    errors.push({ code: "MISSING_SCORING_STRUCTURE" });
  }

  if (hasSections) {
    for (const section of assessment.sections) {
      if (section.maxScore > assessment.maxScore) {
        errors.push({ code: "SECTION_SCORE_EXCEEDS_ASSESSMENT", sectionId: section.id });
      }

      for (const scoringError of validateScoringModel(section.scoringModel, section.maxScore)) {
        errors.push({ code: "SCORING_MODEL_ERROR", targetId: section.id, error: scoringError });
      }
    }

    const sectionTotal = calculateSectionMaxScore(assessment.sections);
    if (sectionTotal !== assessment.maxScore) {
      errors.push({ code: "SECTION_TOTAL_MISMATCH", actual: sectionTotal, expected: assessment.maxScore });
    }
  }

  if (wholeModel) {
    for (const scoringError of validateScoringModel(wholeModel, assessment.maxScore)) {
      errors.push({ code: "SCORING_MODEL_ERROR", targetId: assessment.id, error: scoringError });
    }
  }

  return errors;
}
