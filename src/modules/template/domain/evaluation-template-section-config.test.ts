import { describe, expect, it } from "vitest";

import {
  createDefaultEvaluationTemplateSectionConfig,
  parseEvaluationTemplateSectionConfig,
} from "./evaluation-template-section-config";

describe("evaluation template section config", () => {
  it("creates a teaching-learning format whose right detail area is explicitly modeled", () => {
    const config = createDefaultEvaluationTemplateSectionConfig("teaching_learning_table");
    expect(config.type).toBe("teaching_learning_table");
    if (config.type !== "teaching_learning_table") throw new Error("teaching-learning config expected");

    expect(config.fields.filter((field) => field.placement === "detail").map((field) => field.fieldKey)).toEqual([
      "teachingMethods",
      "evaluationMethods",
    ]);
  });

  it("accepts achievement-rate tables with a subject-specific number of levels", () => {
    const config = parseEvaluationTemplateSectionConfig({
      type: "achievement_rate_table",
      rateLabel: "기준 성취율",
      achievementLabel: "성취도",
      rows: [
        { rate: "80% 이상", achievement: "A" },
        { rate: "60% 이상 ~ 80% 미만", achievement: "B" },
        { rate: "60% 미만", achievement: "C" },
      ],
    });

    expect(config?.type).toBe("achievement_rate_table");
    if (config?.type !== "achievement_rate_table") throw new Error("achievement-rate config expected");
    expect(config.rows).toHaveLength(3);
  });

  it("rejects executable or unknown format types", () => {
    expect(parseEvaluationTemplateSectionConfig({ type: "react_component", code: "return <Table />" })).toBeUndefined();
  });
});
