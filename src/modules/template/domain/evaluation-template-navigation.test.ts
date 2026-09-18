import { describe, expect, it } from "vitest";

import { normalizeEvaluationTemplateSections } from "./evaluation-template";
import { buildEvaluationTemplateSectionNavigation } from "./evaluation-template-navigation";

describe("buildEvaluationTemplateSectionNavigation", () => {
  it("keeps every configured section in its saved hierarchy", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "대분류", level: 1 },
      { id: "a-1", title: "1. 단위", level: 2 },
      { id: "a-1-a", title: "가. 단위", level: 3 },
      { id: "b", title: "다른 대분류", level: 1 },
    ]);

    const navigation = buildEvaluationTemplateSectionNavigation(sections);

    expect(navigation.map((node) => node.section.id)).toEqual(["a", "b"]);
    expect(navigation[0].children[0].section.id).toBe("a-1");
    expect(navigation[0].children[0].children[0].section.id).toBe("a-1-a");
  });
});
