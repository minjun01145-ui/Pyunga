import { describe, expect, it } from "vitest";

import { parseEvaluationTemplateSaveInput } from "./evaluation-template-save";

describe("parseEvaluationTemplateSaveInput", () => {
  it("accepts a repeatable container without subject-specific child items", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [
        { id: "root", title: "평가 세부계획", level: 1, childrenMode: "fixed" },
        { id: "performance", title: "수행평가 세부 계획", level: 2, childrenMode: "repeatable" },
      ],
    });

    expect(template?.sections[1]).toMatchObject({
      id: "performance",
      childrenMode: "repeatable",
      parentId: "root",
    });
  });

  it("keeps backward compatibility by defaulting an old section without childrenMode to fixed", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [
        { id: "root", title: "평가 세부계획", level: 1 },
        { id: "achievement", title: "평가 기준", level: 2 },
        { id: "level", title: "학기단위 성취수준", level: 3 },
      ],
    });

    expect(template?.sections.map((section) => section.childrenMode)).toEqual(["fixed", "fixed", "fixed"]);
  });

  it("rejects static child sections under a repeatable container", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [
        { id: "root", title: "평가 세부계획", level: 1 },
        { id: "performance", title: "수행평가 세부 계획", level: 2, childrenMode: "repeatable" },
        { id: "english-listening", title: "영어듣기평가", level: 3 },
      ],
    });

    expect(template).toBeNull();
  });
});
