import { describe, expect, it } from "vitest";

import {
  moveEvaluationTemplateSection,
  normalizeEvaluationTemplateSections,
  removeEvaluationTemplateSection,
} from "./evaluation-template";

describe("normalizeEvaluationTemplateSections", () => {
  it("assigns order and parent ids across all seven document heading levels", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "l1", title: "평가 세부계획", level: 1 },
      { id: "l2", title: "평가의 목적", level: 2 },
      { id: "l3", title: "평가 방침", level: 3 },
      { id: "l4", title: "세부 기준", level: 4 },
      { id: "l5", title: "적용 대상", level: 5 },
      { id: "l6", title: "지필평가", level: 6 },
      { id: "l7", title: "중간고사", level: 7 },
    ]);

    expect(sections).toEqual([
      { id: "l1", title: "평가 세부계획", level: 1, teacherEditableTitle: false, order: 0 },
      { id: "l2", title: "평가의 목적", level: 2, teacherEditableTitle: false, order: 1, parentId: "l1" },
      { id: "l3", title: "평가 방침", level: 3, teacherEditableTitle: false, order: 2, parentId: "l2" },
      { id: "l4", title: "세부 기준", level: 4, teacherEditableTitle: false, order: 3, parentId: "l3" },
      { id: "l5", title: "적용 대상", level: 5, teacherEditableTitle: false, order: 4, parentId: "l4" },
      { id: "l6", title: "지필평가", level: 6, teacherEditableTitle: false, order: 5, parentId: "l5" },
      { id: "l7", title: "중간고사", level: 7, teacherEditableTitle: false, order: 6, parentId: "l6" },
    ]);
  });

  it("prevents orphaned level jumps", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "평가 세부계획", level: 4 },
      { id: "b", title: "평가의 목적", level: 7 },
    ]);

    expect(sections[0].level).toBe(1);
    expect(sections[1]).toMatchObject({ level: 2, parentId: "a" });
  });

  it("moves a parent section together with its descendants", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "첫 대분류", level: 1, teacherEditableTitle: true },
      { id: "a-1", title: "첫 하위 항목", level: 2 },
      { id: "a-1-1", title: "첫 세부 항목", level: 3 },
      { id: "b", title: "둘째 대분류", level: 1 },
      { id: "b-1", title: "둘째 하위 항목", level: 2 },
    ]);

    const moved = moveEvaluationTemplateSection(sections, 3, -1);
    expect(moved.map((section) => section.id)).toEqual(["b", "b-1", "a", "a-1", "a-1-1"]);
    expect(moved[2].teacherEditableTitle).toBe(true);
    expect(moved[1].parentId).toBe("b");
    expect(moved[4].parentId).toBe("a-1");
  });

  it("removes a section together with all deeper descendants", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "평가 세부계획", level: 1 },
      { id: "a-1", title: "평가 개요", level: 2 },
      { id: "a-1-1", title: "평가의 목적", level: 3 },
      { id: "a-1-1-1", title: "세부 기준", level: 4 },
      { id: "b", title: "다른 대분류", level: 1 },
    ]);

    const remaining = removeEvaluationTemplateSection(sections, 1);
    expect(remaining.map((section) => section.id)).toEqual(["a", "b"]);
  });
});
