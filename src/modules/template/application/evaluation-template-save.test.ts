import { describe, expect, it } from "vitest";

import { parseEvaluationTemplateSaveInput } from "./evaluation-template-save";

describe("parseEvaluationTemplateSaveInput", () => {
  it("accepts and normalizes the seven document heading levels", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [
        { id: "l1", title: "평가 세부계획", level: 1 },
        { id: "l2", title: "평가의 목적", level: 2 },
        { id: "l3", title: "평가 방침", level: 3 },
        { id: "l4", title: "세부 기준", level: 4 },
        { id: "l5", title: "적용 대상", level: 5 },
        { id: "l6", title: "지필평가", level: 6 },
        { id: "l7", title: "중간고사", level: 7 },
      ],
    });

    expect(template?.sections[6]).toMatchObject({
      id: "l7",
      level: 7,
      teacherEditableTitle: false,
      parentId: "l6",
    });
  });

  it("normalizes parent relationships from the submitted flat section list", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [
        { id: "root", title: "평가 세부계획", level: 1 },
        { id: "child", title: "수행평가 세부 계획", level: 2 },
      ],
    });

    expect(template).not.toBeNull();
    expect(template?.sections[0]).toEqual({
      id: "root",
      title: "평가 세부계획",
      level: 1,
      teacherEditableTitle: false,
      order: 0,
    });
    expect(template?.sections[1]).toEqual({
      id: "child",
      title: "수행평가 세부 계획",
      level: 2,
      teacherEditableTitle: false,
      order: 1,
      parentId: "root",
    });
  });

  it("persists whether a subject teacher may replace the section title", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [
        {
          id: "root",
          title: "영어과 교수학습 평가방법",
          level: 1,
          teacherEditableTitle: true,
        },
      ],
    });

    expect(template?.sections[0].teacherEditableTitle).toBe(true);
  });

  it("rejects a section level outside the supported seven levels", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [{ id: "root", title: "평가 세부계획", level: 8 }],
    });

    expect(template).toBeNull();
  });
});
