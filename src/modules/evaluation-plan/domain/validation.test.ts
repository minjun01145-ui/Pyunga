import { describe, expect, it } from "vitest";
import type { EvaluationPlan } from "./evaluation-plan";
import { calculateTotalWeightPercent, validateEvaluationPlan } from "./validation";

const basePlan: EvaluationPlan = {
  id: "plan-1",
  schoolId: "school-1",
  academicYear: 2027,
  semester: 1,
  grade: 3,
  subjectId: "english",
  teacherUserId: "user-1",
  status: "draft",
  writtenAssessments: [
    { id: "written-1", title: "지필평가", weightPercent: 60 },
  ],
  performanceAssessments: [
    {
      id: "performance-1",
      title: "영어 말하기",
      weightPercent: 20,
      maxScore: 100,
      achievementStandardIds: [],
      sections: [],
      wholeAssessmentScoringModel: {
        type: "level_table",
        levels: [{ id: "level-a", label: "A", description: "기준 충족", score: 100 }],
      },
    },
    {
      id: "performance-2",
      title: "영어 쓰기",
      weightPercent: 20,
      maxScore: 100,
      achievementStandardIds: [],
      sections: [],
      wholeAssessmentScoringModel: {
        type: "level_table",
        levels: [{ id: "level-a", label: "A", description: "기준 충족", score: 100 }],
      },
    },
  ],
};

describe("evaluation plan validation", () => {
  it("calculates 100 percent for a valid plan", () => {
    expect(calculateTotalWeightPercent(basePlan)).toBe(100);
    expect(validateEvaluationPlan(basePlan)).toEqual([]);
  });

  it("reports a total weight mismatch", () => {
    const invalidPlan: EvaluationPlan = {
      ...basePlan,
      performanceAssessments: [
        { ...basePlan.performanceAssessments[0], weightPercent: 15 },
        basePlan.performanceAssessments[1],
      ],
    };

    expect(validateEvaluationPlan(invalidPlan)).toContainEqual({
      code: "TOTAL_WEIGHT_NOT_100",
      actual: 95,
    });
  });
});
