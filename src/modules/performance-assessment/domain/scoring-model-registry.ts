import type { ScoringModel } from "./scoring-model";

export type ScoringModelType = ScoringModel["type"];

export type ScoringModelDefinition = {
  type: ScoringModelType;
  label: string;
};

const definitions: Record<ScoringModelType, ScoringModelDefinition> = {
  level_table: {
    type: "level_table",
    label: "수준별 배점",
  },
  threshold_table: {
    type: "threshold_table",
    label: "횟수·기록별 배점",
  },
  criterion_count: {
    type: "criterion_count",
    label: "조건 충족 개수별 배점",
  },
  additive_rubric: {
    type: "additive_rubric",
    label: "세부항목 합산",
  },
  custom_table: {
    type: "custom_table",
    label: "사용자 정의 표",
  },
};

export function getScoringModelDefinition(type: ScoringModelType): ScoringModelDefinition {
  return definitions[type];
}

export function listScoringModelDefinitions(): ScoringModelDefinition[] {
  return Object.values(definitions);
}

export function parseScoringModelType(value: string): ScoringModelType | null {
  switch (value) {
    case "level_table":
    case "threshold_table":
    case "criterion_count":
    case "additive_rubric":
    case "custom_table":
      return value;
    default:
      return null;
  }
}
