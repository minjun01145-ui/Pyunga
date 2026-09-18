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
  it("supports an explicit title-only format", () => {
    expect(createDefaultEvaluationTemplateSectionConfig("title_only")).toEqual({ type: "title_only" });
    expect(parseEvaluationTemplateSectionConfig({ type: "title_only" })).toEqual({ type: "title_only" });
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

  it("migrates known legacy academic-calendar columns to explicit system values", () => {
    const table = createTableTemplateDocument([
      [
        { kind: "text", text: "월", header: true },
        { kind: "text", text: "주", header: true },
        { kind: "text", text: "기간", header: true },
        { kind: "text", text: "주요 학사 일정", header: true },
      ],
      [
        { kind: "input", fieldKey: "month", fieldLabel: "월", inputKind: "text", inputSource: "system" },
        { kind: "input", fieldKey: "week", fieldLabel: "주", inputKind: "text", inputSource: "system" },
        { kind: "input", fieldKey: "dateRange", fieldLabel: "기간", inputKind: "text", inputSource: "system" },
        { kind: "input", fieldKey: "schoolEvents", fieldLabel: "주요 학사 일정", inputKind: "multiline", inputSource: "system" },
      ],
    ]);
    const parsed = parseEvaluationTemplateSectionConfig({
      type: "teaching_learning_table",
      layout: { orientation: "landscape", repeatHeader: true },
      table,
    });
    expect(parsed?.type).toBe("teaching_learning_table");
    if (parsed?.type !== "teaching_learning_table") throw new Error("teaching config expected");

    expect(parsed.calendarRows).toEqual({ enabled: true, periodUnit: "month_week" });
    expect(parsed.table.content[0].content[1].content.map((cell) => cell.attrs.systemValue)).toEqual([
      "academic_calendar.month",
      "academic_calendar.week",
      "academic_calendar.date_range",
      "academic_calendar.events",
    ]);
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
