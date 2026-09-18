import { describe, expect, it } from "vitest";

import type { AiJsonClient } from "../../ai-review";
import { getTableTemplateFieldKeys, tableTemplateCellText } from "../domain/table-template";
import {
  importEvaluationTemplateFromText,
  selectEvaluationTemplateSourceText,
} from "./evaluation-template-import";

describe("evaluation template import", () => {
  it("keeps PDF page boundaries and extracts Korean public-document numbering hints", () => {
    const source = selectEvaluationTemplateSourceText([
      {
        pageNumber: 5,
        orientation: "portrait",
        text: [
          "1. 평가의 목적",
          "가. 평가 방침",
          "1) 세부 기준",
          "가) 적용 대상",
          "(1) 지필평가",
          "(가) 중간고사",
        ].join("\n"),
      },
    ]);

    expect(source.text).toContain("--- PAGE 5 orientation=portrait ---");
    expect(source.headingHints).toEqual([
      "p.5 1. 평가의 목적",
      "p.5 가. 평가 방침",
      "p.5 1) 세부 기준",
      "p.5 가) 적용 대상",
      "p.5 (1) 지필평가",
      "p.5 (가) 중간고사",
    ]);
  });

  it("imports and cleans all seven heading levels", async () => {
    const aiClient: AiJsonClient = {
      async generateJson() {
        return {
          data: {
            documentTitle: "2026학년도 평가계획",
            headings: [
              { title: "평가 세부계획", level: 1, pageNumber: 1 },
              { title: "1. 평가의 목적", level: 2, pageNumber: 1 },
              { title: "가. 평가 방침", level: 3, pageNumber: 1 },
              { title: "1) 세부 기준", level: 4, pageNumber: 2 },
              { title: "가) 적용 대상", level: 5, pageNumber: 2 },
              { title: "(1) 지필평가", level: 6, pageNumber: 3 },
              { title: "(가) 중간고사", level: 7, pageNumber: 3 },
            ],
            warnings: [],
          },
          metrics: { provider: "test", model: "test", elapsedMs: 1 },
        };
      },
    };

    const result = await importEvaluationTemplateFromText({
      sourceText: "평가 세부계획\n1. 평가의 목적\n가. 평가 방침\n1) 세부 기준\n가) 적용 대상\n(1) 지필평가\n(가) 중간고사",
      headingHints: [],
      aiClient,
    });

    expect(result.sections.map((section) => [section.title, section.level])).toEqual([
      ["평가 세부계획", 1],
      ["평가의 목적", 2],
      ["평가 방침", 3],
      ["세부 기준", 4],
      ["적용 대상", 5],
      ["지필평가", 6],
      ["중간고사", 7],
    ]);
    expect(result.sections[6].parentId).toBe(result.sections[5].id);
  });

  it("keeps imported section ids stable when an unrelated preceding root section is added", async () => {
    const buildClient = (includeIntro: boolean): AiJsonClient => ({
      async generateJson() {
        return {
          data: {
            headings: [
              ...(includeIntro ? [{ title: "교수학습-평가 방법", level: 1 as const, pageNumber: 1 }] : []),
              { title: "평가 세부계획", level: 1 as const, pageNumber: 5 },
              { title: "1. 평가 기준", level: 2 as const, pageNumber: 7 },
              { title: "가. 학기단위 성취수준", level: 3 as const, pageNumber: 7 },
              { title: "1) 세부 기준", level: 4 as const, pageNumber: 7 },
            ],
            warnings: [],
          },
          metrics: { provider: "test", model: "test", elapsedMs: 1 },
        };
      },
    });

    const first = await importEvaluationTemplateFromText({
      sourceText: "평가 세부계획 평가 기준 학기단위 성취수준 세부 기준",
      headingHints: [],
      aiClient: buildClient(false),
    });
    const second = await importEvaluationTemplateFromText({
      sourceText: "교수학습 평가 방법 평가 세부계획 평가 기준 학기단위 성취수준 세부 기준",
      headingHints: [],
      aiClient: buildClient(true),
    });

    const firstId = first.sections.find((section) => section.title === "세부 기준")?.id;
    const secondId = second.sections.find((section) => section.title === "세부 기준")?.id;
    expect(firstId).toBe(secondId);
  });

  it("imports the teaching-learning structure into the editable table schema", async () => {
    const aiClient: AiJsonClient = {
      async generateJson() {
        return {
          data: {
            headings: [
              {
                title: "교수학습-평가 방법",
                level: 1,
                pageNumber: 1,
                config: {
                  type: "teaching_learning_table",
                  orientation: "landscape",
                  repeatHeader: true,
                  detailHeaderLabel: "수업-평가 방법, 수업·평가 연계의 주안점",
                  fields: [
                    {
                      id: "ai-period",
                      fieldKey: "period",
                      label: "시기",
                      inputKind: "text",
                      source: "system",
                      placement: "main",
                    },
                    {
                      id: "ai-achievement",
                      fieldKey: "achievementStandards",
                      label: "교육과정 성취기준",
                      inputKind: "achievement_standards",
                      source: "teacher",
                      placement: "main",
                    },
                    {
                      id: "ai-teaching",
                      fieldKey: "teachingMethods",
                      label: "수업",
                      inputKind: "multiline",
                      source: "teacher",
                      placement: "detail",
                    },
                    {
                      id: "ai-evaluation",
                      fieldKey: "evaluationMethods",
                      label: "평가",
                      inputKind: "multiline",
                      source: "teacher",
                      placement: "detail",
                    },
                  ],
                },
              },
            ],
            warnings: [],
          },
          metrics: { provider: "test", model: "test", elapsedMs: 1 },
        };
      },
    };

    const result = await importEvaluationTemplateFromText({
      sourceText: "교수학습-평가 방법 시기 단원명 교육과정 성취기준 평가 요소 수업 평가",
      headingHints: [],
      aiClient,
    });

    const config = result.sections[0].config;
    expect(config?.type).toBe("teaching_learning_table");
    if (config?.type !== "teaching_learning_table") throw new Error("teaching-learning config expected");
    expect(getTableTemplateFieldKeys(config.table)).toEqual([
      "period",
      "achievementStandards",
      "teachingMethods",
      "evaluationMethods",
    ]);
    const detailHeader = config.table.content[0].content[0].content.at(-1);
    expect(detailHeader?.attrs.colspan).toBe(2);
    expect(detailHeader ? tableTemplateCellText(detailHeader) : "").toContain("수업-평가 방법");
    expect(JSON.stringify(config.table)).not.toContain("ai-period");
  });

  it("keeps a three-level achievement-rate table without forcing A-E levels", async () => {
    const aiClient: AiJsonClient = {
      async generateJson() {
        return {
          data: {
            headings: [
              {
                title: "기준 성취율과 성취도",
                level: 1,
                pageNumber: 7,
                config: {
                  type: "achievement_rate_table",
                  rateLabel: "기준 성취율",
                  achievementLabel: "성취도",
                  rows: [
                    { rate: "80% 이상", achievement: "A" },
                    { rate: "60% 이상 ~ 80% 미만", achievement: "B" },
                    { rate: "60% 미만", achievement: "C" },
                  ],
                },
              },
            ],
            warnings: [],
          },
          metrics: { provider: "test", model: "test", elapsedMs: 1 },
        };
      },
    };

    const result = await importEvaluationTemplateFromText({
      sourceText: "기준 성취율과 성취도 80% 이상 A 60% 이상 80% 미만 B 60% 미만 C",
      headingHints: [],
      aiClient,
    });

    const config = result.sections[0].config;
    expect(config?.type).toBe("achievement_rate_table");
    if (config?.type !== "achievement_rate_table") throw new Error("achievement-rate config expected");
    expect(config.table.content[0].content).toHaveLength(4);
    expect(
      config.table.content[0].content.slice(1).map((row) => tableTemplateCellText(row.content[1])),
    ).toEqual(["A", "B", "C"]);
  });
});
