import type { ScoringModel } from "./scoring-model";

export type EvaluationSection = {
  id: string;
  title: string;
  maxScore: number;
  scoringModel: ScoringModel;
};

export type PerformanceAssessment = {
  id: string;
  title: string;
  weightPercent: number;
  maxScore: number;
  achievementStandardIds: string[];
  sections: EvaluationSection[];
  wholeAssessmentScoringModel?: ScoringModel;
};
