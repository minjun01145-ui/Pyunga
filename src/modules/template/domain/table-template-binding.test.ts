import { describe, expect, it } from "vitest";

import {
  applyTableTemplateCellBinding,
  changeTableTemplateCellBindingSource,
  clearTableTemplateCellBinding,
  createAcademicCalendarTableTemplateCellBinding,
  createCustomTableTemplateCellBinding,
} from "./table-template-binding";
import { parseTableTemplateDocument, type TableTemplateCellAttrs } from "./table-template";

const geometry: TableTemplateCellAttrs = {
  colspan: 2,
  rowspan: 3,
  colwidth: [120, 160],
};

describe("table template binding", () => {
  it("applies calendar bindings without changing cell geometry", () => {
    const attrs = applyTableTemplateCellBinding(
      geometry,
      createAcademicCalendarTableTemplateCellBinding("calendar.events", "academic_calendar.events"),
    );

    expect(attrs).toMatchObject({
      colspan: 2,
      rowspan: 3,
      colwidth: [120, 160],
      fieldKey: "calendar.events",
      fieldLabel: "주요 학사 일정",
      inputKind: "multiline",
      inputSource: "system",
      systemValue: "academic_calendar.events",
      required: false,
    });
  });

  it("strips systemValue when a system binding becomes teacher-entered", () => {
    const system = createAcademicCalendarTableTemplateCellBinding(
      "calendar.month",
      "academic_calendar.month",
    );
    const teacher = changeTableTemplateCellBindingSource(system, "teacher");
    const attrs = applyTableTemplateCellBinding(geometry, teacher);

    expect(attrs.inputSource).toBe("teacher");
    expect(attrs.systemValue).toBeUndefined();
  });

  it("clears binding metadata while preserving spans and widths", () => {
    const bound = applyTableTemplateCellBinding(geometry, createCustomTableTemplateCellBinding("custom.note"));
    expect(clearTableTemplateCellBinding(bound)).toEqual(geometry);
  });

  it("produces bindings that round-trip through the restricted table parser", () => {
    const attrs = applyTableTemplateCellBinding(geometry, createCustomTableTemplateCellBinding("custom.note"));
    const parsed = parseTableTemplateDocument({
      type: "doc",
      content: [{
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [{
              type: "tableCell",
              attrs: { ...attrs, colspan: 1, rowspan: 1, colwidth: [120] },
              content: [{ type: "paragraph" }],
            }],
          },
        ],
      }],
    });

    expect(parsed?.content[0].content[0].content[0].attrs.fieldKey).toBe("custom.note");
  });
});
