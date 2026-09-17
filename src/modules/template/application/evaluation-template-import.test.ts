import { describe, expect, it } from "vitest";

import type { AiJsonClient } from "../../ai-review";
import {
  importEvaluationTemplateFromText,
  selectEvaluationTemplateSourceText,
} from "./evaluation-template-import";

describe("evaluation template import", () => {
  it("keeps PDF page boundaries and extracts numbered heading hints", () => {
    const source = selectEvaluationTemplateSourceText([
      { pageNumber: 1, text: "1 영어과 교수학습-평가 방법\n시기 단원명 교육과정 성취기준" },
      { pageNumber: 5, text: "2 영어과 평가 세부계획\nⅠ 평가 개요\n1. 평가의 목적" },
    ]);

    expect(source.pageNumbers).toEqual([1, 5]);
    expect(source.text).toContain("--- PAGE 5 ---");
    expect(source.headingHints).toContain("p.5 Ⅰ 평가 개요");
  });

  it("keeps fixed achievement-level headings but separates subject-specific performance assessment names", async () => {
    const aiClient: AiJsonClient = {
      async generateJson() {
        return {
          data: {
            documentTitle: "2026학년도 2학기 3학년 영어과 교수학습 및 평가 운영 계획",
            headings: [
              { title: "1 영어과 교수학습-평가 방법", level: 1, childrenMode: "fixed", pageNumber: 1 },
              { title: "2 영어과 평가 세부계획", level: 1, childrenMode: "fixed", pageNumber: 5 },
              { title: "Ⅰ 평가 개요", level: 2, childrenMode: "fixed", pageNumber: 5 },
              { title: "1. 평가의 목적", level: 3, childrenMode: "fixed", pageNumber: 5 },
              { title: "Ⅱ 평가 기준", level: 2, childrenMode: "fixed", pageNumber: 7 },
              { title: "1. 기준 성취율과 성취도", level: 3, childrenMode: "fixed", pageNumber: 7 },
              { title: "2. 학기단위 성취수준", level: 3, childrenMode: "fixed", pageNumber: 7 },
              { title: "Ⅴ 수행평가 세부 계획", level: 2, childrenMode: "repeatable", pageNumber: 9 },
              { title: "1. 영어듣기능력평가", level: 3, childrenMode: "fixed", pageNumber: 9 },
              { title: "2. 영어 말하기", level: 3, childrenMode: "fixed", pageNumber: 10 },
              { title: "3. 영어 글쓰기", level: 3, childrenMode: "fixed", pageNumber: 11 },
              { title: "Ⅵ 평가 결과 활용", level: 2, childrenMode: "fixed", pageNumber: 11 },
            ],
            warnings: [],
          },
          metrics: { provider: "test", model: "test", elapsedMs: 1 },
        };
      },
    };

    const result = await importEvaluationTemplateFromText({
      sourceText: "--- PAGE 1 ---\n1 영어과 교수학습-평가 방법\n--- PAGE 9 ---\nⅤ 수행평가 세부 계획",
      headingHints: [],
      aiClient,
    });

    expect(result.sections.map((section) => section.title)).toEqual([
      "영어과 교수학습-평가 방법",
      "영어과 평가 세부계획",
      "평가 개요",
      "평가의 목적",
      "평가 기준",
      "기준 성취율과 성취도",
      "학기단위 성취수준",
      "수행평가 세부 계획",
      "평가 결과 활용",
    ]);
    expect(result.sections.find((section) => section.title === "수행평가 세부 계획")).toMatchObject({
      childrenMode: "repeatable",
    });
    const performanceSection = result.sections.find((section) => section.title === "수행평가 세부 계획");
    expect(performanceSection).toBeDefined();
    expect(result.repeatableItemSamples).toEqual([
      { parentSectionId: performanceSection?.id, title: "영어듣기능력평가", sourcePage: 9 },
      { parentSectionId: performanceSection?.id, title: "영어 말하기", sourcePage: 10 },
      { parentSectionId: performanceSection?.id, title: "영어 글쓰기", sourcePage: 11 },
    ]);
  });

  it("keeps imported section ids stable when unrelated preceding sections are added", async () => {
    const buildClient = (includeIntro: boolean): AiJsonClient => ({
      async generateJson() {
        return {
          data: {
            headings: [
              ...(includeIntro
                ? [{ title: "교수학습-평가 방법", level: 1 as const, childrenMode: "fixed" as const, pageNumber: 1 }]
                : []),
              { title: "평가 세부계획", level: 1, childrenMode: "fixed", pageNumber: 5 },
              { title: "평가 기준", level: 2, childrenMode: "fixed", pageNumber: 7 },
              { title: "학기단위 성취수준", level: 3, childrenMode: "fixed", pageNumber: 7 },
            ],
            warnings: [],
          },
          metrics: { provider: "test", model: "test", elapsedMs: 1 },
        };
      },
    });

    const first = await importEvaluationTemplateFromText({
      sourceText: "평가 세부계획 평가 기준 학기단위 성취수준",
      headingHints: [],
      aiClient: buildClient(false),
    });
    const second = await importEvaluationTemplateFromText({
      sourceText: "교수학습 평가 방법 평가 세부계획 평가 기준 학기단위 성취수준",
      headingHints: [],
      aiClient: buildClient(true),
    });

    const firstId = first.sections.find((section) => section.title === "학기단위 성취수준")?.id;
    const secondId = second.sections.find((section) => section.title === "학기단위 성취수준")?.id;
    expect(firstId).toBe(secondId);
  });

  it("recognizes a performance-assessment plan as repeatable even if the AI returns fixed", async () => {
    const aiClient: AiJsonClient = {
      async generateJson() {
        return {
          data: {
            headings: [
              { title: "평가 세부계획", level: 1, childrenMode: "fixed", pageNumber: 1 },
              { title: "수행평가 세부계획", level: 2, childrenMode: "fixed", pageNumber: 2 },
              { title: "프로젝트", level: 3, childrenMode: "fixed", pageNumber: 2 },
            ],
            warnings: [],
          },
          metrics: { provider: "test", model: "test", elapsedMs: 1 },
        };
      },
    };

    const result = await importEvaluationTemplateFromText({
      sourceText: "평가 세부계획\n수행평가 세부계획\n프로젝트 수행평가 항목",
      headingHints: [],
      aiClient,
    });

    expect(result.sections).toHaveLength(2);
    expect(result.sections[1].childrenMode).toBe("repeatable");
    expect(result.repeatableItemSamples[0].title).toBe("프로젝트");
  });
});
