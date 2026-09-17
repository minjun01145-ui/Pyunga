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

  it("turns the reviewed AI heading list into a normalized section hierarchy", async () => {
    const aiClient: AiJsonClient = {
      async generateJson() {
        return {
          data: {
            documentTitle: "2026학년도 2학기 3학년 영어과 교수학습 및 평가 운영 계획",
            headings: [
              { title: "1 영어과 교수학습-평가 방법", level: 1, pageNumber: 1 },
              { title: "2 영어과 평가 세부계획", level: 1, pageNumber: 5 },
              { title: "Ⅰ 평가 개요", level: 2, pageNumber: 5 },
              { title: "1. 평가의 목적", level: 3, pageNumber: 5 },
              { title: "2. 평가의 기본 방향", level: 3, pageNumber: 5 },
              { title: "Ⅱ 평가 기준", level: 2, pageNumber: 7 },
              { title: "Ⅲ 평가 방법", level: 2, pageNumber: 8 },
              { title: "Ⅳ 정기시험 세부 계획", level: 2, pageNumber: 9 },
              { title: "Ⅴ 수행평가 세부 계획", level: 2, pageNumber: 9 },
              { title: "Ⅵ 평가 결과 활용", level: 2, pageNumber: 11 },
            ],
            warnings: [],
          },
          metrics: { provider: "test", model: "test", elapsedMs: 1 },
        };
      },
    };

    const result = await importEvaluationTemplateFromText({
      sourceText: "--- PAGE 1 ---\n1 영어과 교수학습-평가 방법\n--- PAGE 5 ---\n2 영어과 평가 세부계획",
      headingHints: [],
      aiClient,
    });

    expect(result.sections.map((section) => section.title)).toEqual([
      "영어과 교수학습-평가 방법",
      "영어과 평가 세부계획",
      "평가 개요",
      "평가의 목적",
      "평가의 기본 방향",
      "평가 기준",
      "평가 방법",
      "정기시험 세부 계획",
      "수행평가 세부 계획",
      "평가 결과 활용",
    ]);
    expect(result.sections[3]).toMatchObject({ level: 3, parentId: "section-3", sourcePage: 5 });
    expect(result.sections[9]).toMatchObject({ level: 2, parentId: "section-2", sourcePage: 11 });
  });
});
