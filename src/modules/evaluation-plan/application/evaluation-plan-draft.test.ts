import { describe, expect, it } from "vitest";

import {
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanDraftTemplateIssues,
  getEvaluationPlanTemplateSignature,
  parseEvaluationPlanDraft,
  type EvaluationPlanDraft,
} from "./evaluation-plan-draft";
import { createTableTemplateDocument, type EvaluationTemplate } from "@/modules/template";

describe("evaluation plan draft", () => {
  it("creates an empty form draft without inventing school operating data", () => {
    expect(createEmptyEvaluationPlanDraft()).toEqual({
      academicYear: "",
      semester: "",
      grade: "",
      subjectLabel: "",
      sections: {},
    });
  });

  it("parses template-bound section values while preserving blank form state", () => {
    const draft = parseEvaluationPlanDraft({
      academicYear: "2027",
      semester: "1",
      grade: "3",
      subjectLabel: "영어",
      sections: {
        "section-1": {
          title: "평가의 방향",
          body: "과정 중심으로 평가한다.",
          fields: {
            assessmentArea: "말하기",
            competencies: ["의사소통", "공동체"],
          },
        },
      },
    });

    expect(draft?.sections["section-1"].fields.competencies).toEqual(["의사소통", "공동체"]);
  });

  it("rejects oversized arbitrary field values", () => {
    expect(parseEvaluationPlanDraft({
      academicYear: "2027",
      semester: "1",
      grade: "3",
      subjectLabel: "영어",
      sections: {
        "section-1": {
          fields: { note: "x".repeat(10_001) },
        },
      },
    })).toBeNull();
  });

  it("changes the template signature when a binding changes", () => {
    const base: EvaluationTemplate = {
      sections: [{
        id: "section-1",
        title: "평가 방법",
        level: 1,
        teacherEditableTitle: false,
        order: 0,
      }],
    };
    const changed: EvaluationTemplate = {
      sections: [{ ...base.sections[0], title: "평가 방법 및 유의사항" }],
    };

    expect(getEvaluationPlanTemplateSignature(base)).not.toBe(getEvaluationPlanTemplateSignature(changed));
    expect(getEvaluationPlanTemplateSignature(base)).toBe(getEvaluationPlanTemplateSignature(structuredClone(base)));
  });

  it("validates required and percentage fields against the current template", () => {
    const template: EvaluationTemplate = {
      sections: [{
        id: "method",
        title: "평가 방법",
        level: 1,
        teacherEditableTitle: false,
        order: 0,
        config: {
          type: "evaluation_method_table",
          layout: { orientation: "portrait", repeatHeader: false },
          table: createTableTemplateDocument([
            [
              {
                kind: "input",
                fieldKey: "area",
                fieldLabel: "평가영역",
                inputKind: "text",
                inputSource: "teacher",
                required: true,
              },
              {
                kind: "input",
                fieldKey: "weight",
                fieldLabel: "반영비율",
                inputKind: "percentage",
                inputSource: "teacher",
              },
            ],
          ]),
        },
      }],
    };
    const invalid: EvaluationPlanDraft = {
      ...createEmptyEvaluationPlanDraft(),
      sections: {
        method: { fields: { area: "", weight: "150" } },
      },
    };

    expect(getEvaluationPlanDraftTemplateIssues(template, invalid).map((issue) => issue.fieldKey)).toEqual([
      "area",
      "weight",
    ]);
    expect(getEvaluationPlanDraftTemplateIssues(template, {
      ...invalid,
      sections: { method: { fields: { area: "말하기", weight: "40" } } },
    })).toEqual([]);
  });
});
