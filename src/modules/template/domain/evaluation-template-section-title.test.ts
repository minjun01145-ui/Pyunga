import { describe, expect, it } from "vitest";

import { getTeacherSectionTitlePresentation } from "./evaluation-template-section-title";

describe("getTeacherSectionTitlePresentation", () => {
  it("keeps the administrator title fixed when teacher editing is disabled", () => {
    expect(
      getTeacherSectionTitlePresentation({
        title: "교수·학습 및 평가 연계계획",
        teacherEditableTitle: false,
      }),
    ).toEqual({ editable: false, fixedTitle: "교수·학습 및 평가 연계계획" });
  });

  it("uses the administrator title as the teacher's example when editing is enabled", () => {
    expect(
      getTeacherSectionTitlePresentation({
        title: "영어과 교수학습 평가방법",
        teacherEditableTitle: true,
      }),
    ).toEqual({ editable: true, exampleTitle: "영어과 교수학습 평가방법" });
  });
});
