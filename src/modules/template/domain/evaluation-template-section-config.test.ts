import { describe, expect, it } from "vitest";

import {
  EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES,
  createDefaultEvaluationTemplateSectionConfig,
  getEvaluationTemplateSectionConfigIssues,
  parseEvaluationTemplateSectionConfig,
} from "./evaluation-template-section-config";
import {
  createTableTemplateDocument,
  getTableTemplateFieldKeys,
  tableTemplateCellText,
} from "./table-template";

describe("evaluation template section config", () => {
  it("creates a teaching-learning table with bound input cells and a merged detail header", () => {
    const config = createDefaultEvaluationTemplateSectionConfig("teaching_learning_table");
    expect(config.type).toBe("teaching_learning_table");
    if (config.type !== "teaching_learning_table") throw new Error("teaching-learning config expected");

    expect(getTableTemplateFieldKeys(config.table)).toEqual([
      "period",
      "lessonHours",
      "unitName",
      "achievementStandards",
      "evaluationElements",
      "teachingMethods",
      "evaluationMethods",
    ]);
    const firstRow = config.table.content[0].content[0];
    const detailHeader = firstRow.content.at(-1);
    expect(detailHeader?.attrs.colspan).toBe(2);
    expect(detailHeader ? tableTemplateCellText(detailHeader) : "").toContain("수업-평가 방법");
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
    expect(config.layout).toEqual({ orientation: "portrait", repeatHeader: true });
    expect(config.table.content[0].content).toHaveLength(4);
    expect(
      config.table.content[0].content.slice(1).map((row) => tableTemplateCellText(row.content[1])),
    ).toEqual(["A", "B", "C"]);
  });

  it("treats a stored editable table as canonical instead of keeping stale legacy fields", () => {
    const table = createTableTemplateDocument([
      [
        { kind: "text", text: "기준 성취율", header: true },
        { kind: "text", text: "성취도", header: true },
      ],
      [
        { kind: "text", text: "직접 수정한 기준" },
        { kind: "text", text: "A" },
      ],
    ]);
    const config = parseEvaluationTemplateSectionConfig({
      type: "achievement_rate_table",
      layout: { orientation: "portrait", repeatHeader: true },
      table,
      rateLabel: "예전 제목",
      achievementLabel: "예전 성취도",
      rows: [
        { rate: "예전 기준", achievement: "E" },
        { rate: "예전 기준 2", achievement: "D" },
      ],
    });

    expect(config).toEqual({
      type: "achievement_rate_table",
      layout: { orientation: "portrait", repeatHeader: true },
      table,
    });
    expect(config).not.toHaveProperty("rows");
  });

  it("rejects executable or unknown format types", () => {
    expect(parseEvaluationTemplateSectionConfig({ type: "react_component", code: "return <Table />" })).toBeUndefined();
  });

  it("creates valid default configs for every supported section format", () => {
    for (const type of EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES) {
      const config = createDefaultEvaluationTemplateSectionConfig(type);
      expect(getEvaluationTemplateSectionConfigIssues(config), type).toEqual([]);
    }
  });

  it("migrates legacy written and performance config into the canonical editable table", () => {
    const written = parseEvaluationTemplateSectionConfig({
      type: "written_assessment_table",
      fields: [
        {
          id: "weight",
          fieldKey: "weightPercent",
          label: "반영 비율",
          inputKind: "percentage",
          source: "teacher",
        },
      ],
    });
    expect(written?.type).toBe("written_assessment_table");
    if (written?.type !== "written_assessment_table") throw new Error("written config expected");
    expect(getTableTemplateFieldKeys(written.table)).toEqual(["weightPercent"]);

    const performance = parseEvaluationTemplateSectionConfig({
      type: "performance_assessment_table",
      headerFields: [
        {
          id: "standards",
          fieldKey: "achievementStandards",
          label: "성취기준",
          inputKind: "achievement_standards",
          source: "teacher",
        },
      ],
      rubricColumnLabels: ["단계", "배점", "평가 기준"],
    });
    expect(performance?.type).toBe("performance_assessment_table");
    if (performance?.type !== "performance_assessment_table") throw new Error("performance config expected");
    expect(getTableTemplateFieldKeys(performance.table)).toEqual(["achievementStandards"]);
    expect(
      performance.table.content[0].content.at(-2)?.content.map((cell) => tableTemplateCellText(cell)),
    ).toEqual(["단계", "배점", "평가 기준"]);
  });
});
