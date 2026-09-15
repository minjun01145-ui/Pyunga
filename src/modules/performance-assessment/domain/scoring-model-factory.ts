import type {
  AdditiveRubricModel,
  CriterionCountModel,
  LevelTableModel,
  ScoringModel,
  ThresholdTableModel,
} from "./scoring-model";
import type { ScoringModelType } from "./scoring-model-registry";

export type IdFactory = () => string;

export function createDefaultScoringModel(
  type: Exclude<ScoringModelType, "custom_table">,
  maxScore: number,
  createId: IdFactory,
): Exclude<ScoringModel, { type: "custom_table" }> {
  switch (type) {
    case "level_table":
      return createLevelTableModel(maxScore, createId);
    case "threshold_table":
      return createThresholdTableModel(maxScore, createId);
    case "criterion_count":
      return createCriterionCountModel(maxScore, createId);
    case "additive_rubric":
      return createAdditiveRubricModel(maxScore, createId);
  }
}

function createLevelTableModel(maxScore: number, createId: IdFactory): LevelTableModel {
  return {
    type: "level_table",
    levels: [
      { id: createId(), label: "상", description: "", score: maxScore },
      { id: createId(), label: "중", description: "", score: Math.max(0, maxScore - 5) },
      { id: createId(), label: "하", description: "", score: Math.max(0, maxScore - 10) },
    ],
  };
}

function createThresholdTableModel(maxScore: number, createId: IdFactory): ThresholdTableModel {
  return {
    type: "threshold_table",
    metricLabel: "횟수 또는 기록",
    rows: [
      { id: createId(), conditionLabel: "최상 기준", score: maxScore },
      { id: createId(), conditionLabel: "다음 기준", score: Math.max(0, maxScore - 10) },
    ],
  };
}

function createCriterionCountModel(maxScore: number, createId: IdFactory): CriterionCountModel {
  return {
    type: "criterion_count",
    criteria: [
      { id: createId(), description: "조건 1" },
      { id: createId(), description: "조건 2" },
      { id: createId(), description: "조건 3" },
      { id: createId(), description: "조건 4" },
    ],
    scoreBySatisfiedCount: [
      { id: createId(), satisfiedCount: 4, score: maxScore },
      { id: createId(), satisfiedCount: 3, score: Math.max(0, maxScore - 5) },
      { id: createId(), satisfiedCount: 2, score: Math.max(0, maxScore - 10) },
      { id: createId(), satisfiedCount: 1, score: Math.max(0, maxScore - 15) },
      { id: createId(), satisfiedCount: 0, score: 0 },
    ],
  };
}

function createAdditiveRubricModel(maxScore: number, createId: IdFactory): AdditiveRubricModel {
  return {
    type: "additive_rubric",
    items: [
      {
        id: createId(),
        label: "세부항목 1",
        maxScore,
        levels: [
          { id: createId(), description: "충족", score: maxScore },
          { id: createId(), description: "부분 충족", score: Math.max(0, maxScore - 5) },
        ],
      },
    ],
  };
}
