import type { ScoringModel } from "./scoring-model";

export type ScoringModelType = ScoringModel["type"];

export type ScoringModelDefinition = {
  type: ScoringModelType;
  label: string;
  supportsAutomaticScoreValidation: boolean;
};

const definitions: Record<ScoringModelType, ScoringModelDefinition> = {
  level_table: {
    type: "level_table",
    label: "수준별 배점",
    supportsAutomaticScoreValidation: true,
  },
  threshold_table: {
    type: "threshold_table",
    label: "횟수·기록별 배점",
    supportsAutomaticScoreValidation: true,
  },
  criterion_count: {
    type: "criterion_count",
    label: "조건 충족 개수별 배점",
    supportsAutomaticScoreValidation: true,
  },
  additive_rubric: {
    type: "additive_rubric",
    label: "세부항목 합산",
    supportsAutomaticScoreValidation: true,
  },
  custom_table: {
    type: "custom_table",
    label: "사용자 정의 표",
    supportsAutomaticScoreValidation: false,
  },
};

export function getScoringModelDefinition(type: ScoringModelType): ScoringModelDefinition {
  return definitions[type];
}

export function listScoringModelDefinitions(): ScoringModelDefinition[] {
  return Object.values(definitions);
}
