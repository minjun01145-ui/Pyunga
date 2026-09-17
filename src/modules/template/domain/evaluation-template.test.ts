import { describe, expect, it } from "vitest";

import {
  moveEvaluationTemplateSection,
  normalizeEvaluationTemplateSections,
  removeEvaluationTemplateSection,
} from "./evaluation-template";

describe("normalizeEvaluationTemplateSections", () => {
  it("assigns order and parent ids from a flat three-level structure", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "교수학습-평가 방법", level: 1 },
      { id: "b", title: "평가 세부계획", level: 1 },
      { id: "c", title: "평가 개요", level: 2 },
      { id: "d", title: "평가의 목적", level: 3 },
      { id: "e", title: "평가 기준", level: 2 },
    ]);

    expect(sections).toEqual([
      { id: "a", title: "교수학습-평가 방법", level: 1, order: 0 },
      { id: "b", title: "평가 세부계획", level: 1, order: 1 },
      { id: "c", title: "평가 개요", level: 2, order: 2, parentId: "b" },
      { id: "d", title: "평가의 목적", level: 3, order: 3, parentId: "c" },
      { id: "e", title: "평가 기준", level: 2, order: 4, parentId: "b" },
    ]);
  });

  it("prevents an orphaned level jump", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "평가 세부계획", level: 2 },
      { id: "b", title: "평가의 목적", level: 3 },
    ]);

    expect(sections[0].level).toBe(1);
    expect(sections[1]).toMatchObject({ level: 2, parentId: "a" });
  });
  it("moves a parent section together with its descendants", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "첫 대분류", level: 1 },
      { id: "a-1", title: "첫 중분류", level: 2 },
      { id: "b", title: "둘째 대분류", level: 1 },
      { id: "b-1", title: "둘째 중분류", level: 2 },
    ]);

    const moved = moveEvaluationTemplateSection(sections, 2, -1);
    expect(moved.map((section) => section.id)).toEqual(["b", "b-1", "a", "a-1"]);
    expect(moved[1].parentId).toBe("b");
  });

  it("removes a section together with its descendants", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "평가 세부계획", level: 1 },
      { id: "a-1", title: "평가 개요", level: 2 },
      { id: "a-1-1", title: "평가의 목적", level: 3 },
      { id: "b", title: "다른 대분류", level: 1 },
    ]);

    const remaining = removeEvaluationTemplateSection(sections, 1);
    expect(remaining.map((section) => section.id)).toEqual(["a", "b"]);
  });

});
