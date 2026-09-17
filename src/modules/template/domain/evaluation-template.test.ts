import { describe, expect, it } from "vitest";

import {
  getEvaluationTemplateIssues,
  moveEvaluationTemplateSection,
  normalizeEvaluationTemplateSections,
  removeEvaluationTemplateSection,
  setEvaluationTemplateSectionChildrenMode,
} from "./evaluation-template";

describe("normalizeEvaluationTemplateSections", () => {
  it("assigns order, parent ids, and fixed child mode from a flat three-level structure", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "교수학습-평가 방법", level: 1 },
      { id: "b", title: "평가 세부계획", level: 1 },
      { id: "c", title: "평가 개요", level: 2 },
      { id: "d", title: "평가의 목적", level: 3 },
      { id: "e", title: "평가 기준", level: 2 },
    ]);

    expect(sections).toEqual([
      { id: "a", title: "교수학습-평가 방법", level: 1, order: 0, childrenMode: "fixed" },
      { id: "b", title: "평가 세부계획", level: 1, order: 1, childrenMode: "fixed" },
      { id: "c", title: "평가 개요", level: 2, order: 2, parentId: "b", childrenMode: "fixed" },
      { id: "d", title: "평가의 목적", level: 3, order: 3, parentId: "c", childrenMode: "fixed" },
      { id: "e", title: "평가 기준", level: 2, order: 4, parentId: "b", childrenMode: "fixed" },
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

  it("forces a level-three leaf to fixed child mode", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "평가 기준", level: 1 },
      { id: "b", title: "학기단위 성취수준", level: 2 },
      { id: "c", title: "세부 항목", level: 3, childrenMode: "repeatable" },
    ]);

    expect(sections[2].childrenMode).toBe("fixed");
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

  it("removes static descendants when a section becomes a repeatable item container", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "평가 세부계획", level: 1 },
      { id: "b", title: "수행평가 세부 계획", level: 2 },
      { id: "c", title: "영어듣기능력평가", level: 3 },
      { id: "d", title: "평가 결과 활용", level: 2 },
    ]);

    const updated = setEvaluationTemplateSectionChildrenMode(sections, 1, "repeatable");

    expect(updated.map((section) => section.id)).toEqual(["a", "b", "d"]);
    expect(updated[1]).toMatchObject({ childrenMode: "repeatable", parentId: "a" });
  });

  it("rejects persisted static descendants under a repeatable container", () => {
    const sections = normalizeEvaluationTemplateSections([
      { id: "a", title: "평가 세부계획", level: 1 },
      { id: "b", title: "수행평가 세부 계획", level: 2, childrenMode: "repeatable" },
      { id: "c", title: "영어듣기능력평가", level: 3 },
    ]);

    expect(getEvaluationTemplateIssues({ sections })).toContain(
      "'수행평가 세부 계획'은 교과별 반복 항목 영역이므로 공통 하위 항목을 함께 저장할 수 없습니다.",
    );
  });
});
