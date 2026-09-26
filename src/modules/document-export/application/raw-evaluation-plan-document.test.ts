import { describe, expect, it } from "vitest";

import type { AcademicCalendarEvent } from "@/modules/academic-calendar";
import type { EvaluationPlanDraft } from "@/modules/evaluation-plan";
import { DEMO_TEACHER_EVALUATION_CONTEXT } from "@/modules/evaluation-plan";
import {
  createTableTemplateDocument,
  parseTableTemplateDocument,
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

  it("keeps unconfigured and explicit title-only sections distinct in the raw view", () => {
    const template: EvaluationTemplate = {
      sections: [
        {
          id: "unconfigured",
          title: "미설정",
          level: 1,
          teacherEditableTitle: false,
          order: 0,
        },
        {
          id: "title-only",
          title: "제목만",
          level: 1,
          teacherEditableTitle: false,
          order: 1,
          config: { type: "title_only" },
        },
      ],
    };

    const view = buildRawEvaluationPlanDocument(template, draft);
    expect(view.sections[0].content.kind).toBe("unconfigured");
    expect(view.sections[1].content.kind).toBe("none");
  });

  it("includes evaluator-managed common wording before the subject text", () => {
    const template: EvaluationTemplate = {
      sections: [{
        id: "policy",
        title: "평가 방침",
        level: 1,
        teacherEditableTitle: false,
        order: 0,
        config: {
          type: "outline_text",
          numberingLevels: ["decimal_dot"],
          commonText: "미제출 평가의 처리 기준은 학교 규정에 따른다.",
        },
      }],
    };
    const subjectDraft = {
      ...draft,
      sections: { policy: { fields: {}, body: "교과별 추가 안내" } },
    };

    expect(buildRawEvaluationPlanDocument(template, subjectDraft).sections[0].content).toEqual({
      kind: "text",
      text: "미제출 평가의 처리 기준은 학교 규정에 따른다.\n\n교과별 추가 안내",
    });
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

    expect(view.title).toBe("영어과 학교 평가계획");
    expect(view.firstPageOrientation).toBe("landscape");
    expect(view.sections[0].title).toBe("교과에서 정한 제목");
    expect(view.sections[0].orientation).toBe("landscape");
    expect(tableSection.orientation).toBe("landscape");
    expect(tableSection.content.kind).toBe("table");
    if (tableSection.content.kind === "table") {
      expect(tableSection.content.table.repeatHeader).toBe(true);
      expect(tableSection.content.table.headerRows).toHaveLength(1);
      expect(tableSection.content.table.columnWidths).toEqual([120, 180]);
      expect(tableSection.content.table.bodyGroups[0][0][0].text).toBe("말하기 수행평가");
      expect(tableSection.content.table.bodyGroups[0][0][1].text).toBe("□ 발표 준비\n□ 상호 평가");
    }
    expect(JSON.stringify(template)).toBe(templateBefore);
  });

  it("resolves ProseMirror zero sentinels to visible widths in the printable table view", () => {
    const editorDocument = createTableTemplateDocument([
      [{ kind: "text", text: "A-B", header: true, colspan: 2, colwidth: [120, 20] }],
      [{ kind: "text", text: "A" }, { kind: "text", text: "B" }],
    ]);
    editorDocument.content[0].content[0].content[0].attrs.colwidth = [120, 0];
    const table = parseTableTemplateDocument(JSON.parse(JSON.stringify(editorDocument)));
    expect(table).toBeDefined();
    if (!table) return;

    const view = buildRawEvaluationPlanDocument({
      sections: [{
        id: "table",
        title: "평가 내용",
        level: 1,
        teacherEditableTitle: false,
        order: 0,
        config: {
          type: "written_assessment_table",
          layout: { orientation: "landscape", repeatHeader: false },
          table,
        },
      }],
    }, draft);
    const content = view.sections[0].content;

    expect(content.kind).toBe("table");
    if (content.kind === "table") expect(content.table.columnWidths).toEqual([120, 120]);
  });

  it("adds the assigned subject to the document title without duplicating its suffix", () => {
    const template: EvaluationTemplate = {
      documentTitle: "영어과 교수학습 및 평가 계획",
      sections: [],
    };
    const subjectDraft = { ...draft, subjectLabel: "영어" };

    expect(buildRawEvaluationPlanDocument(template, subjectDraft).title)
      .toBe("영어과 교수학습 및 평가 계획");
    expect(buildRawEvaluationPlanDocument(template, { ...subjectDraft, subjectLabel: "영어과" }).title)
      .toBe("영어과 교수학습 및 평가 계획");
    expect(buildRawEvaluationPlanDocument({ ...template, documentTitle: "영어과목 선택 안내" }, subjectDraft).title)
      .toBe("영어과 영어과목 선택 안내");
  });

  it("uses the teacher context subject for the document title", () => {
    const template: EvaluationTemplate = {
      documentTitle: "교수학습 및 평가 계획",
      sections: [],
    };

    expect(buildRawEvaluationPlanDocument(template, { ...draft, subjectLabel: "수학" }, {
      teacherContext: { ...DEMO_TEACHER_EVALUATION_CONTEXT, subjectLabel: "영어" },
      calendarEvents: [],
    }).title).toBe("영어과 교수학습 및 평가 계획");
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
      expect(content.table.repeatHeader).toBe(false);
      expect(content.table.headerRows).toHaveLength(0);
      expect(content.table.bodyGroups[0]).toHaveLength(2);
    }
  });

  it("expands a teaching-learning body block for academic-calendar rows and resolves system cells", () => {
    const table = createTableTemplateDocument([
      [
        { kind: "text", text: "월", header: true },
        { kind: "text", text: "주", header: true },
        { kind: "text", text: "기간", header: true },
        { kind: "text", text: "단원", header: true },
        { kind: "text", text: "주요 학사 일정", header: true },
      ],
      [
        { kind: "input", fieldKey: "month", fieldLabel: "월", inputKind: "text", inputSource: "system", systemValue: "academic_calendar.month" },
        { kind: "input", fieldKey: "week", fieldLabel: "주", inputKind: "text", inputSource: "system", systemValue: "academic_calendar.week" },
        { kind: "input", fieldKey: "range", fieldLabel: "기간", inputKind: "text", inputSource: "system", systemValue: "academic_calendar.date_range" },
        { kind: "input", fieldKey: "unitName", fieldLabel: "단원", inputKind: "text", inputSource: "teacher" },
        { kind: "input", fieldKey: "events", fieldLabel: "주요 학사 일정", inputKind: "multiline", inputSource: "system", systemValue: "academic_calendar.events" },
      ],
    ]);
    const template: EvaluationTemplate = {
      sections: [{
        id: "teaching",
        title: "교수학습 운영 계획",
        level: 1,
        teacherEditableTitle: false,
        order: 0,
        config: {
          type: "teaching_learning_table",
          layout: { orientation: "landscape", repeatHeader: true },
          calendarRows: { enabled: true, periodUnit: "month_week" },
          table,
        },
      }],
    };
    const calendarEvents: AcademicCalendarEvent[] = [
      {
        id: "opening",
        schoolId: "development-school",
        academicYear: 2026,
        title: "입학식, 1학기 개학일",
        type: "school_event",
        semester: 1,
        startDate: "2026-03-03",
        targetGrades: [1, 2, 3],
      },
      {
        id: "later",
        schoolId: "development-school",
        academicYear: 2026,
        title: "전국연합",
        type: "school_event",
        semester: 1,
        startDate: "2026-03-24",
        targetGrades: [3],
      },
    ];
    const calendarDraft: EvaluationPlanDraft = {
      ...draft,
      academicYear: "2026",
      sections: {
        teaching: {
          fields: {},
          rows: {
            "2026-03-w1": { fields: { unitName: "오리엔테이션" } },
          },
        },
      },
    };

    const view = buildRawEvaluationPlanDocument(template, calendarDraft, {
      teacherContext: { ...DEMO_TEACHER_EVALUATION_CONTEXT, semester: 1 },
      calendarEvents,
    });
    const content = view.sections[0].content;
    expect(content.kind).toBe("table");
    if (content.kind === "table") {
      expect(content.table.headerRows).toHaveLength(1);
      expect(content.table.bodyGroups[0][0].map((cell) => cell.text)).toEqual([
        "3",
        "1",
        "3/2~3/8",
        "오리엔테이션",
        "3/3 입학식, 1학기 개학일",
      ]);
      expect(content.table.bodyGroups.length).toBeGreaterThan(1);
    }
  });
});
