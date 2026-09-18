import { describe, expect, it } from "vitest";

import type { EvaluationPlanDraft } from "@/modules/evaluation-plan";
import {
  createTableTemplateDocument,
  type EvaluationTemplate,
} from "@/modules/template";

import { buildRawEvaluationPlanDocument } from "./raw-evaluation-plan-document";

const draft: EvaluationPlanDraft = {
  academicYear: "2027",
  semester: "1",
  grade: "3",
  subjectLabel: "영어",
  sections: {
    table: {
      fields: {
        content: "말하기 수행평가",
        checks: ["발표 준비", "상호 평가"],
      },
    },
    editable: {
      title: "교과에서 정한 제목",
      fields: {},
    },
  },
};

describe("raw evaluation plan document", () => {
  it("formats the seven public-document heading levels deterministically", () => {
    const template: EvaluationTemplate = {
      sections: [1, 2, 3, 4, 5, 6, 7].map((level, index) => ({
        id: `s${level}`,
        title: `제목 ${level}`,
        level: level as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        teacherEditableTitle: false,
        order: index,
        ...(level > 1 ? { parentId: `s${level - 1}` } : {}),
      })),
    };

    const view = buildRawEvaluationPlanDocument(template, draft);
    expect(view.sections.map((section) => section.marker)).toEqual(["", "1.", "가.", "1)", "가)", "(1)", "(가)"]);
    expect(view.metadataLine).toBe("2027학년도 · 1학기 · 3학년 · 영어");
  });

  it("resolves editable titles and bound table values without mutating the template", () => {
    const table = createTableTemplateDocument([
      [
        { kind: "text", text: "내용", header: true, colwidth: [120] },
        { kind: "text", text: "확인", header: true, colwidth: [180] },
      ],
      [
        { kind: "input", fieldKey: "content", fieldLabel: "내용", inputKind: "multiline", inputSource: "teacher" },
        { kind: "input", fieldKey: "checks", fieldLabel: "확인", inputKind: "checkbox_list", inputSource: "teacher" },
      ],
    ]);
    const template: EvaluationTemplate = {
      documentTitle: "학교 평가계획",
      sections: [
        {
          id: "editable",
          title: "예시 제목",
          level: 1,
          teacherEditableTitle: true,
          order: 0,
        },
        {
          id: "table",
          title: "평가 내용",
          level: 2,
          teacherEditableTitle: false,
          parentId: "editable",
          order: 1,
          config: {
            type: "written_assessment_table",
            layout: { orientation: "landscape", repeatHeader: true },
            table,
          },
        },
      ],
    };
    const templateBefore = JSON.stringify(template);

    const view = buildRawEvaluationPlanDocument(template, draft);
    const tableSection = view.sections[1];

    expect(view.title).toBe("학교 평가계획");
    expect(view.firstPageOrientation).toBe("landscape");
    expect(view.sections[0].title).toBe("교과에서 정한 제목");
    expect(view.sections[0].orientation).toBe("landscape");
    expect(tableSection.orientation).toBe("landscape");
    expect(tableSection.content.kind).toBe("table");
    if (tableSection.content.kind === "table") {
      expect(tableSection.content.table.repeatingHeaderRowCount).toBe(1);
      expect(tableSection.content.table.columnWidths).toEqual([120, 180]);
      expect(tableSection.content.table.rows[1][0].text).toBe("말하기 수행평가");
      expect(tableSection.content.table.rows[1][1].text).toBe("□ 발표 준비\n□ 상호 평가");
    }
    expect(JSON.stringify(template)).toBe(templateBefore);
  });

  it("does not split a rowspan across repeated header and body row groups", () => {
    const table = createTableTemplateDocument([
      [
        { kind: "text", text: "구분", header: true, rowspan: 2 },
        { kind: "text", text: "내용", header: true },
      ],
      [
        { kind: "input", fieldKey: "content", fieldLabel: "내용", inputKind: "text", inputSource: "teacher" },
      ],
    ]);
    const template: EvaluationTemplate = {
      sections: [{
        id: "table",
        title: "평가 내용",
        level: 1,
        teacherEditableTitle: false,
        order: 0,
        config: {
          type: "written_assessment_table",
          layout: { orientation: "portrait", repeatHeader: true },
          table,
        },
      }],
    };

    const view = buildRawEvaluationPlanDocument(template, draft);
    const content = view.sections[0].content;
    expect(content.kind).toBe("table");
    if (content.kind === "table") {
      expect(content.table.repeatingHeaderRowCount).toBe(0);
    }
  });
});
