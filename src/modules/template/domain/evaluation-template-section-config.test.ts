import { describe, expect, it } from "vitest";

import {
  EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES,
  createDefaultEvaluationTemplateSectionConfig,
  getEvaluationTemplateSectionConfigIssues,
  parseCanonicalEvaluationTemplateSectionConfig,
  parseEvaluationTemplateSectionConfig,
} from "./evaluation-template-section-config";
import {
  createTableTemplateDocument,
  getTableTemplateFieldKeys,
  tableTemplateCellText,
} from "./table-template";

describe("evaluation template section config", () => {
  it("supports an explicit title-only format", () => {
    expect(createDefaultEvaluationTemplateSectionConfig("title_only")).toEqual({ type: "title_only" });
    expect(parseEvaluationTemplateSectionConfig({ type: "title_only" })).toEqual({ type: "title_only" });
  });

  it("keeps the public parser backward-compatible while the canonical parser stays strict", () => {
    const legacy = {
      type: "achievement_rate_table",
      rateLabel: "기준 성취율",
      achievementLabel: "성취도",
      rows: [
        { rate: "80% 이상", achievement: "A" },
        { rate: "80% 미만", achievement: "B" },
      ],
    };

    expect(parseEvaluationTemplateSectionConfig(legacy)?.type).toBe("achievement_rate_table");
    expect(parseCanonicalEvaluationTemplateSectionConfig(legacy)).toBeUndefined();
  });

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
    expect(config.calendarRows).toEqual({ enabled: true, periodUnit: "month_week" });
    expect(config.table.content[0].content[1].content[0].attrs.systemValue).toBe("academic_calendar.period");
    const firstRow = config.table.content[0].content[0];
    const detailHeader = firstRow.content.at(-1);
    expect(detailHeader?.attrs.colspan).toBe(2);
    expect(detailHeader ? tableTemplateCellText(detailHeader) : "").toContain("수업-평가 방법");
  });

  it("persists monthly calendar-row settings on a canonical teaching-learning table", () => {
    const config = createDefaultEvaluationTemplateSectionConfig("teaching_learning_table");
    if (config.type !== "teaching_learning_table") throw new Error("teaching config expected");
    const parsed = parseEvaluationTemplateSectionConfig({
      ...config,
      calendarRows: { enabled: true, periodUnit: "month" },
    });
    expect(parsed?.type).toBe("teaching_learning_table");
    if (parsed?.type !== "teaching_learning_table") throw new Error("teaching config expected");
    expect(parsed.calendarRows).toEqual({ enabled: true, periodUnit: "month" });
  });

  it("rejects academic-calendar system values outside a teaching-learning table", () => {
    const config = createDefaultEvaluationTemplateSectionConfig("written_assessment_table");
    if (config.type !== "written_assessment_table") throw new Error("written config expected");
    const table = createTableTemplateDocument([
      [{ kind: "text", text: "월", header: true }],
      [{
        kind: "input",
        fieldKey: "month",
        fieldLabel: "월",
        inputKind: "text",
        inputSource: "system",
        systemValue: "academic_calendar.month",
      }],
    ]);
    expect(getEvaluationTemplateSectionConfigIssues({ ...config, table })).toContain(
      "학사일정 자동값은 교수학습-평가 표에서만 사용할 수 있습니다.",
    );
  });

  it("rejects a weekly system value when teaching rows are monthly", () => {
    const config = createDefaultEvaluationTemplateSectionConfig("teaching_learning_table");
    if (config.type !== "teaching_learning_table") throw new Error("teaching config expected");
    const table = createTableTemplateDocument([
      [{ kind: "text", text: "주", header: true }],
      [{
        kind: "input",
        fieldKey: "week",
        fieldLabel: "주",
        inputKind: "text",
        inputSource: "system",
        systemValue: "academic_calendar.week",
      }],
    ]);
    expect(getEvaluationTemplateSectionConfigIssues({
      ...config,
      calendarRows: { enabled: true, periodUnit: "month" },
      table,
    })).toContain("월 단위 자동 행에서는 '학사일정: 주' 값을 사용할 수 없습니다.");
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

});
