import type {
  AdditiveRubricModel,
  CriterionCountModel,
  LevelTableModel,
  ScoringModel,
  ThresholdTableModel,
} from "../domain/scoring-model";
import type { ScoringModelType } from "../domain/scoring-model-registry";

type EditableScoringModel = Exclude<ScoringModel, { type: "custom_table" }>;
type EditableScoringModelType = Exclude<ScoringModelType, "custom_table">;
type IdFactory = () => string;

export function createInitialScoringModel(
  type: EditableScoringModelType,
  maxScore: number,
  createId: IdFactory,
): EditableScoringModel {
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
      { id: createId(), label: "기준 1", description: "", score: maxScore },
    ],
  };
}

function createThresholdTableModel(maxScore: number, createId: IdFactory): ThresholdTableModel {
  return {
    type: "threshold_table",
    metricLabel: "횟수 또는 기록",
    rows: [
      { id: createId(), conditionLabel: "기준 1", score: maxScore },
    ],
  };
}

function createCriterionCountModel(maxScore: number, createId: IdFactory): CriterionCountModel {
  return {
    type: "criterion_count",
    criteria: [
      { id: createId(), description: "조건 1" },
    ],
    scoreBySatisfiedCount: [
      { id: createId(), satisfiedCount: 1, score: maxScore },
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
          { id: createId(), description: "기준 충족", score: maxScore },
        ],
      },
    ],
  };
}
