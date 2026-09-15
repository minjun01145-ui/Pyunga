export type LevelTableModel = {
  type: "level_table";
  levels: Array<{
    id: string;
    label: string;
    description: string;
    score: number;
  }>;
};

export type ThresholdTableModel = {
  type: "threshold_table";
  metricLabel: string;
  rows: Array<{
    id: string;
    conditionLabel: string;
    score: number;
  }>;
};

export type CriterionCountModel = {
  type: "criterion_count";
  criteria: Array<{
    id: string;
    description: string;
  }>;
  scoreBySatisfiedCount: Array<{
    id: string;
    satisfiedCount: number;
    score: number;
  }>;
};

export type AdditiveRubricModel = {
  type: "additive_rubric";
  items: Array<{
    id: string;
    label: string;
    maxScore: number;
    levels: Array<{
      id: string;
      description: string;
      score: number;
    }>;
  }>;
};

export type CustomTableModel = {
  type: "custom_table";
  columns: Array<{ id: string; label: string }>;
  rows: Array<Record<string, string>>;
};

export type ScoringModel =
  | LevelTableModel
  | ThresholdTableModel
  | CriterionCountModel
  | AdditiveRubricModel
  | CustomTableModel;
