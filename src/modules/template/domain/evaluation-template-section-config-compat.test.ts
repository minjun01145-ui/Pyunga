import { describe, expect, it } from "vitest";

import {
  createTableTemplateDocument,
  getTableTemplateFieldKeys,
  tableTemplateCellText,
} from "./table-template";
import { parseCompatibleEvaluationTemplateSectionConfig } from "./evaluation-template-section-config-compat";

describe("evaluation template section config compatibility", () => {
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
    const parsed = parseCompatibleEvaluationTemplateSectionConfig({
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

  it("keeps subject-specific achievement-rate levels", () => {
    const config = parseCompatibleEvaluationTemplateSectionConfig({
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

  it("converts legacy written and performance config into canonical tables", () => {
    const written = parseCompatibleEvaluationTemplateSectionConfig({
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

    const performance = parseCompatibleEvaluationTemplateSectionConfig({
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

  it("prefers an explicit stored table and never falls back when that table is invalid", () => {
    const table = createTableTemplateDocument([
      [{ kind: "text", text: "직접 수정한 제목", header: true }],
      [{ kind: "text", text: "직접 수정한 내용" }],
    ]);
    const stored = parseCompatibleEvaluationTemplateSectionConfig({
      type: "achievement_rate_table",
      table,
      rateLabel: "예전 제목",
      achievementLabel: "예전 성취도",
      rows: [
        { rate: "예전 기준 1", achievement: "A" },
        { rate: "예전 기준 2", achievement: "B" },
      ],
    });

    expect(stored?.type).toBe("achievement_rate_table");
    if (stored?.type !== "achievement_rate_table") throw new Error("achievement-rate config expected");
    expect(stored.table).toEqual(table);
    expect(stored.layout).toEqual({ orientation: "portrait", repeatHeader: true });

    expect(parseCompatibleEvaluationTemplateSectionConfig({
      type: "achievement_rate_table",
      table: { type: "invalid" },
      rateLabel: "예전 제목",
      achievementLabel: "예전 성취도",
      rows: [
        { rate: "예전 기준 1", achievement: "A" },
        { rate: "예전 기준 2", achievement: "B" },
      ],
    })).toBeUndefined();
  });
});
