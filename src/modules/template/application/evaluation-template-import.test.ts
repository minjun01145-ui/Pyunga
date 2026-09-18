import { describe, expect, it } from "vitest";

import type { AiJsonClient } from "../../ai-review";
import {
  importEvaluationTemplateFromText,
  selectEvaluationTemplateSourceText,
} from "./evaluation-template-import";

describe("evaluation template import", () => {
  it("keeps PDF page boundaries and extracts Korean public-document numbering hints", () => {
    const source = selectEvaluationTemplateSourceText([
      {
        pageNumber: 5,
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

    expect(source.text).toContain("--- PAGE 5 ---");
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
});
