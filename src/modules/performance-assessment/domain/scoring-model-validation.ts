import type { ScoringModel } from "./scoring-model";

export type ScoringModelValidationError =
  | { code: "EMPTY_SCORING_MODEL" }
  | { code: "SCORE_OUT_OF_RANGE"; score: number; maxScore: number }
  | { code: "DUPLICATE_SATISFIED_COUNT"; satisfiedCount: number }
  | { code: "SATISFIED_COUNT_OUT_OF_RANGE"; satisfiedCount: number; criteriaCount: number }
  | { code: "ADDITIVE_ITEM_TOTAL_MISMATCH"; actual: number; expected: number }
  | { code: "ITEM_LEVEL_SCORE_OUT_OF_RANGE"; itemId: string; score: number; maxScore: number };

export function validateScoringModel(
  model: ScoringModel,
  maxScore: number,
): ScoringModelValidationError[] {
  const errors: ScoringModelValidationError[] = [];

  switch (model.type) {
    case "level_table":
      if (model.levels.length === 0) {
        errors.push({ code: "EMPTY_SCORING_MODEL" });
      }
      addScoreRangeErrors(model.levels.map((level) => level.score), maxScore, errors);
      break;

    case "threshold_table":
      if (model.rows.length === 0) {
        errors.push({ code: "EMPTY_SCORING_MODEL" });
      }
      addScoreRangeErrors(model.rows.map((row) => row.score), maxScore, errors);
      break;

    case "criterion_count": {
      if (model.criteria.length === 0 || model.scoreBySatisfiedCount.length === 0) {
        errors.push({ code: "EMPTY_SCORING_MODEL" });
      }

      const seenCounts = new Set<number>();
      for (const row of model.scoreBySatisfiedCount) {
        if (seenCounts.has(row.satisfiedCount)) {
          errors.push({ code: "DUPLICATE_SATISFIED_COUNT", satisfiedCount: row.satisfiedCount });
        }
        seenCounts.add(row.satisfiedCount);

        if (row.satisfiedCount < 0 || row.satisfiedCount > model.criteria.length) {
          errors.push({
            code: "SATISFIED_COUNT_OUT_OF_RANGE",
            satisfiedCount: row.satisfiedCount,
            criteriaCount: model.criteria.length,
          });
        }
      }
      addScoreRangeErrors(model.scoreBySatisfiedCount.map((row) => row.score), maxScore, errors);
      break;
    }

    case "additive_rubric": {
      if (model.items.length === 0) {
        errors.push({ code: "EMPTY_SCORING_MODEL" });
      }

      const itemTotal = model.items.reduce((sum, item) => sum + item.maxScore, 0);
      if (itemTotal !== maxScore) {
        errors.push({ code: "ADDITIVE_ITEM_TOTAL_MISMATCH", actual: itemTotal, expected: maxScore });
      }

      for (const item of model.items) {
        for (const level of item.levels) {
          if (!isScoreInRange(level.score, item.maxScore)) {
            errors.push({
              code: "ITEM_LEVEL_SCORE_OUT_OF_RANGE",
              itemId: item.id,
              score: level.score,
              maxScore: item.maxScore,
            });
          }
        }
      }
      break;
    }

    case "custom_table":
      // Custom tables are intentionally only structurally stored in Phase 2.
      // Automatic score validation is not promised for this fallback type.
      break;
  }

  return errors;
}

function addScoreRangeErrors(
  scores: number[],
  maxScore: number,
  errors: ScoringModelValidationError[],
): void {
  for (const score of scores) {
    if (!isScoreInRange(score, maxScore)) {
      errors.push({ code: "SCORE_OUT_OF_RANGE", score, maxScore });
    }
  }
}

function isScoreInRange(score: number, maxScore: number): boolean {
  return Number.isFinite(score) && score >= 0 && score <= maxScore;
}
