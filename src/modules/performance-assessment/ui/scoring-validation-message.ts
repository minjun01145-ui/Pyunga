import type { PerformanceValidationError } from "../domain/validation";
import type { ScoringModelValidationError } from "../domain/scoring-model-validation";

export function formatPerformanceValidationError(error: PerformanceValidationError): string {
  switch (error.code) {
    case "NEGATIVE_WEIGHT":
      return "반영비율은 0 이상이어야 합니다.";
    case "WEIGHT_OVER_100":
      return "수행평가 반영비율은 100%를 초과할 수 없습니다.";
    case "NEGATIVE_MAX_SCORE":
      return "수행평가 총점은 0 이상이어야 합니다.";
    case "SECTION_SCORE_EXCEEDS_ASSESSMENT":
      return `평가영역(${error.sectionId})의 배점이 수행평가 총점을 초과합니다.`;
    case "SECTION_TOTAL_MISMATCH":
      return `평가영역 배점 합계가 ${error.actual}점입니다. 수행평가 총점 ${error.expected}점과 일치해야 합니다.`;
    case "MISSING_SCORING_STRUCTURE":
      return "평가영역 또는 전체 평가기준 중 하나를 입력해야 합니다.";
    case "AMBIGUOUS_SCORING_STRUCTURE":
      return "평가영역 방식과 전체 단일기준 방식을 동시에 사용할 수 없습니다.";
    case "SCORING_MODEL_ERROR":
      return formatScoringModelValidationError(error.error);
  }
}

function formatScoringModelValidationError(error: ScoringModelValidationError): string {
  switch (error.code) {
    case "EMPTY_SCORING_MODEL":
      return "세부 평가기준이 비어 있습니다.";
    case "SCORE_OUT_OF_RANGE":
      return `세부 점수 ${error.score}점이 허용 범위(0~${error.maxScore})를 벗어났습니다.`;
    case "DUPLICATE_SATISFIED_COUNT":
      return `조건 ${error.satisfiedCount}개 충족에 대한 점수가 중복되어 있습니다.`;
    case "SATISFIED_COUNT_OUT_OF_RANGE":
      return `조건은 ${error.criteriaCount}개인데 ${error.satisfiedCount}개 충족 규칙이 입력되어 있습니다.`;
    case "ADDITIVE_ITEM_TOTAL_MISMATCH":
      return `세부항목 최고점 합계가 ${error.actual}점입니다. 영역 배점 ${error.expected}점과 일치해야 합니다.`;
    case "ITEM_LEVEL_SCORE_OUT_OF_RANGE":
      return `세부항목의 점수 ${error.score}점이 해당 항목 최고점 ${error.maxScore}점을 벗어났습니다.`;
  }
}
