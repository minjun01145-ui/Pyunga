import { describe, expect, it } from "vitest";
import type { ScoringModel } from "./scoring-model";
import { validateScoringModel } from "./scoring-model-validation";

describe("scoring model validation", () => {
  it("rejects scores above the section maximum", () => {
    const model: ScoringModel = {
      type: "level_table",
      levels: [{ id: "l1", label: "상", description: "", score: 35 }],
    };

    expect(validateScoringModel(model, 30)).toContainEqual({
      code: "SCORE_OUT_OF_RANGE",
      score: 35,
      maxScore: 30,
    });
  });

  it("rejects impossible satisfied counts", () => {
    const model: ScoringModel = {
      type: "criterion_count",
      criteria: [
        { id: "c1", description: "조건 1" },
        { id: "c2", description: "조건 2" },
      ],
      scoreBySatisfiedCount: [
        { id: "r1", satisfiedCount: 3, score: 30 },
      ],
    };

    expect(validateScoringModel(model, 30)).toContainEqual({
      code: "SATISFIED_COUNT_OUT_OF_RANGE",
      satisfiedCount: 3,
      criteriaCount: 2,
    });
  });

  it("checks additive item maximums against the parent maximum", () => {
    const model: ScoringModel = {
      type: "additive_rubric",
      items: [
        {
          id: "i1",
          label: "내용",
          maxScore: 10,
          levels: [{ id: "l1", description: "충족", score: 10 }],
        },
        {
          id: "i2",
          label: "표현",
          maxScore: 10,
          levels: [{ id: "l2", description: "충족", score: 10 }],
        },
      ],
    };

    expect(validateScoringModel(model, 30)).toContainEqual({
      code: "ADDITIVE_ITEM_TOTAL_MISMATCH",
      actual: 20,
      expected: 30,
    });
  });
});
