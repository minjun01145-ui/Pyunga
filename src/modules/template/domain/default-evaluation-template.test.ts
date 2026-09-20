import { describe, expect, it } from "vitest";

import { getEvaluationTemplateIssues } from "./evaluation-template";
import { createDefaultEvaluationTemplate } from "./default-evaluation-template";

describe("createDefaultEvaluationTemplate", () => {
  it("creates a complete valid standard form without unconfigured sections", () => {
    const template = createDefaultEvaluationTemplate();

    expect(template.documentTitle).toBe("교수학습 및 평가 운영 계획");
    expect(template.sections).toHaveLength(16);
    expect(template.sections.every((section) => section.config !== undefined)).toBe(true);
    expect(getEvaluationTemplateIssues(template)).toEqual([]);
  });

  it("mirrors the standard evaluation-plan hierarchy and table formats", () => {
    const template = createDefaultEvaluationTemplate();
    const byId = new Map(template.sections.map((section) => [section.id, section]));

    expect(byId.get("teaching-learning")).toMatchObject({
      title: "교수학습-평가 방법",
      level: 1,
      config: {
        type: "teaching_learning_table",
        calendarRows: { enabled: true, periodUnit: "month" },
      },
    });
    expect(byId.get("evaluation-purpose")?.config?.type).toBe("outline_text");
    expect(byId.get("achievement-rate")?.config?.type).toBe("achievement_rate_table");
    expect(byId.get("semester-achievement-level")?.config?.type).toBe("semester_achievement_level_table");
    expect(byId.get("evaluation-method")?.config?.type).toBe("evaluation_method_table");
    expect(byId.get("written-assessment")?.config?.type).toBe("written_assessment_table");
    expect(byId.get("performance-assessment")?.config?.type).toBe("title_only");
    expect(byId.get("evaluation-results-use")?.config?.type).toBe("outline_text");

    for (const id of ["performance-assessment-1", "performance-assessment-2", "performance-assessment-3"]) {
      expect(byId.get(id)).toMatchObject({
        level: 3,
        teacherEditableTitle: true,
        parentId: "performance-assessment",
        config: { type: "performance_assessment_table" },
      });
    }
  });
});
