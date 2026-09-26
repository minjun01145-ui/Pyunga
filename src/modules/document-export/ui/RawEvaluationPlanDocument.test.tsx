import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createEmptyEvaluationPlanDraft } from "@/modules/evaluation-plan";
import {
  updateEvaluationTemplateSection,
  type EvaluationTemplate,
} from "@/modules/template";
import { buildRawEvaluationPlanDocument } from "../application/raw-evaluation-plan-document";
import { RawEvaluationPlanDocument } from "./RawEvaluationPlanDocument";

const template: EvaluationTemplate = {
  presentation: { style: "standard", schoolName: "" },
  sections: [
    {
      id: "policy",
      title: "평가 방침",
      level: 1,
      teacherEditableTitle: false,
      order: 0,
      config: { type: "outline_text", numberingLevels: ["decimal_dot"], commonText: "학교 공통 문구" },
    },
    {
      id: "assessment-table",
      title: "평가 계획",
      level: 1,
      teacherEditableTitle: false,
      order: 1,
      config: { type: "title_only" },
    },
  ],
};

describe("RawEvaluationPlanDocument section identity contract", () => {
  it.each(["standard", "official", "compact"] as const)(
    "renders the same section ids with the %s presentation style",
    (style) => {
      const view = buildRawEvaluationPlanDocument(
        { ...template, presentation: { style, schoolName: "" } },
        createEmptyEvaluationPlanDraft(),
      );
      const markup = renderToStaticMarkup(<RawEvaluationPlanDocument view={view} />);

      expect(markup).toContain('data-template-section-id="policy"');
      expect(markup).toContain('data-template-section-id="assessment-table"');
    },
  );

  it("keeps the section marker while updated title and config values reach the preview", () => {
    const sections = updateEvaluationTemplateSection(template.sections, "policy", {
      title: "수정된 평가 방침",
      config: { type: "outline_text", numberingLevels: ["decimal_dot"], commonText: "변경된 공통 문구" },
    });
    const view = buildRawEvaluationPlanDocument({ ...template, sections }, createEmptyEvaluationPlanDraft());
    const markup = renderToStaticMarkup(<RawEvaluationPlanDocument view={view} />);

    expect(markup).toContain('data-template-section-id="policy"');
    expect(markup).toContain("수정된 평가 방침");
    expect(markup).toContain("변경된 공통 문구");
  });
});
