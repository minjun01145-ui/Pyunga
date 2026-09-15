import { describe, expect, it } from "vitest";
import type { PerformanceAssessment } from "./performance-assessment";
import { validatePerformanceAssessment } from "./validation";

function levelModel(maxScore: number) {
  return {
    type: "level_table" as const,
    levels: [
      { id: "level-1", label: "충족", description: "기준 충족", score: maxScore },
    ],
  };
}

describe("performance assessment validation", () => {
  it("accepts a 30/30/40 section structure for a 100 point assessment", () => {
    const assessment: PerformanceAssessment = {
      id: "pa-1",
      title: "말하기",
      weightPercent: 20,
      maxScore: 100,
      achievementStandardIds: [],
      sections: [
        { id: "s1", title: "내용", maxScore: 30, scoringModel: levelModel(30) },
        { id: "s2", title: "표현", maxScore: 30, scoringModel: levelModel(30) },
        { id: "s3", title: "전달력", maxScore: 40, scoringModel: levelModel(40) },
      ],
    };

    expect(validatePerformanceAssessment(assessment)).toEqual([]);
  });

  it("reports when section totals do not match max score", () => {
    const assessment: PerformanceAssessment = {
      id: "pa-2",
      title: "말하기",
      weightPercent: 20,
      maxScore: 100,
      achievementStandardIds: [],
      sections: [
        { id: "s1", title: "내용", maxScore: 30, scoringModel: levelModel(30) },
        { id: "s2", title: "표현", maxScore: 30, scoringModel: levelModel(30) },
        { id: "s3", title: "전달력", maxScore: 30, scoringModel: levelModel(30) },
      ],
    };

    expect(validatePerformanceAssessment(assessment)).toContainEqual({
      code: "SECTION_TOTAL_MISMATCH",
      actual: 90,
      expected: 100,
    });
  });

  it("accepts a whole-assessment scoring model when sections are not used", () => {
    const assessment: PerformanceAssessment = {
      id: "pa-3",
      title: "자유투",
      weightPercent: 30,
      maxScore: 100,
      achievementStandardIds: [],
      sections: [],
      wholeAssessmentScoringModel: {
        type: "threshold_table",
        metricLabel: "성공 횟수",
        rows: [
          { id: "row-1", conditionLabel: "10개 성공", score: 100 },
          { id: "row-2", conditionLabel: "9개 성공", score: 90 },
        ],
      },
    };

    expect(validatePerformanceAssessment(assessment)).toEqual([]);
  });

  it("rejects using sections and a whole-assessment model at the same time", () => {
    const assessment: PerformanceAssessment = {
      id: "pa-4",
      title: "혼합 오류 예시",
      weightPercent: 20,
      maxScore: 100,
      achievementStandardIds: [],
      sections: [
        { id: "s1", title: "내용", maxScore: 100, scoringModel: levelModel(100) },
      ],
      wholeAssessmentScoringModel: levelModel(100),
    };

    expect(validatePerformanceAssessment(assessment)).toContainEqual({
      code: "AMBIGUOUS_SCORING_STRUCTURE",
    });
  });
});
