import { describe, expect, it } from "vitest";

import { createDefaultEvaluationTemplateSectionConfig } from "../domain/evaluation-template-section-config";
import { getTableTemplateFieldKeys } from "../domain/table-template";
import {
  parseEvaluationTemplateSaveInput,
  parseEvaluationTemplateSaveRequest,
} from "./evaluation-template-save";

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

  it("round-trips a legacy teaching-learning input format through the compatibility boundary", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [
        {
          id: "teaching",
          title: "교수학습-평가 방법",
          level: 1,
          config: {
            type: "teaching_learning_table",
            orientation: "landscape",
            repeatHeader: true,
            detailHeaderLabel: "수업-평가 방법, 수업·평가 연계의 주안점",
            fields: [
              {
                id: "period",
                fieldKey: "period",
                label: "시기",
                inputKind: "text",
                source: "system",
                placement: "main",
              },
              {
                id: "evaluation-methods",
                fieldKey: "evaluationMethods",
                label: "평가",
                inputKind: "multiline",
                source: "teacher",
                placement: "detail",
              },
            ],
          },
        },
      ],
    });

    expect(template?.sections[0].config).toMatchObject({
      type: "teaching_learning_table",
      layout: {
        orientation: "landscape",
        repeatHeader: true,
      },
    });
  });

  it("round-trips the canonical editable table document", () => {
    const config = createDefaultEvaluationTemplateSectionConfig("teaching_learning_table");
    const template = parseEvaluationTemplateSaveInput({
      sections: [{
        id: "teaching",
        title: "교수학습-평가 방법",
        level: 1,
        config,
      }],
    });

    const savedConfig = template?.sections[0].config;
    expect(savedConfig?.type).toBe("teaching_learning_table");
    if (savedConfig?.type !== "teaching_learning_table") throw new Error("teaching-learning config expected");
    expect(getTableTemplateFieldKeys(savedConfig.table)).toContain("achievementStandards");
    expect(savedConfig.table.content[0].content[0].content.at(-1)?.attrs.colspan).toBe(2);
  });

  it("rejects an invalid section format instead of storing arbitrary config", () => {
    const template = parseEvaluationTemplateSaveInput({
      sections: [
        {
          id: "teaching",
          title: "교수학습-평가 방법",
          level: 1,
          config: {
            type: "teaching_learning_table",
            orientation: "diagonal",
            repeatHeader: true,
            fields: [],
          },
        },
      ],
    });

    expect(template).toBeNull();
  });

  it("parses a versioned save request for optimistic concurrency", () => {
    const request = parseEvaluationTemplateSaveRequest({
      expectedRevision: 3,
      template: {
        sections: [{ id: "root", title: "평가 세부계획", level: 1 }],
      },
    });

    expect(request?.expectedRevision).toBe(3);
    expect(request?.template.sections[0].id).toBe("root");
    expect(parseEvaluationTemplateSaveRequest({
      expectedRevision: -1,
      template: { sections: [{ id: "root", title: "평가 세부계획", level: 1 }] },
    })).toBeNull();
  });

  it("accepts the previous raw-template request only against the initial revision", () => {
    const request = parseEvaluationTemplateSaveRequest({
      sections: [{ id: "root", title: "평가 세부계획", level: 1 }],
    });

    expect(request?.expectedRevision).toBe(0);
    expect(request?.template.sections[0].id).toBe("root");
  });
});
