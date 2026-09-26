import { describe, expect, it } from "vitest";

import {
  createTableTemplateDocument,
  getTableTemplateCellPlacements,
  getTableTemplateColumnWidths,
  getTableTemplateFieldKeys,
  parseTableTemplateDocument,
} from "./table-template";

describe("table template", () => {
  it("keeps merged-cell geometry and input bindings in the restricted schema", () => {
    const document = createTableTemplateDocument([
      [
        { kind: "text", text: "평가 방법", header: true, colspan: 2 },
      ],
      [
        {
          kind: "input",
          fieldKey: "evaluationMethods",
          fieldLabel: "평가 방법",
          inputKind: "multiline",
          inputSource: "teacher",
          rowspan: 2,
        },
        { kind: "text", text: "관찰" },
      ],
      [
        { kind: "text", text: "포트폴리오" },
      ],
    ]);

    const parsed = parseTableTemplateDocument(document);
    expect(parsed).toBeDefined();
    expect(parsed?.content[0].content[0].content[0].attrs.colspan).toBe(2);
    expect(parsed?.content[0].content[1].content[0].attrs.rowspan).toBe(2);
    expect(getTableTemplateFieldKeys(document)).toEqual(["evaluationMethods"]);
  });

  it("accepts null editor attributes and strips attributes outside the saved schema", () => {
    const parsed = parseTableTemplateDocument({
      type: "doc",
      content: [{
        type: "table",
        content: [{
          type: "tableRow",
          content: [{
            type: "tableCell",
            attrs: {
              colspan: 1,
              rowspan: 1,
              colwidth: null,
              align: null,
              fieldKey: null,
              fieldLabel: null,
              inputKind: null,
              inputSource: null,
              required: null,
            },
            content: [{ type: "paragraph" }],
          }],
        }],
      }],
    });

    expect(parsed).toEqual(createTableTemplateDocument([[{ kind: "text", text: "" }]]));
  });

  it("allows an input label to be temporarily cleared while editing", () => {
    const parsed = parseTableTemplateDocument({
      type: "doc",
      content: [{
        type: "table",
        content: [{
          type: "tableRow",
          content: [{
            type: "tableCell",
            attrs: {
              colspan: 1,
              rowspan: 1,
              colwidth: null,
              fieldKey: "assessmentArea",
              fieldLabel: "",
              inputKind: "text",
              inputSource: "teacher",
              required: false,
            },
            content: [{ type: "paragraph" }],
          }],
        }],
      }],
    });

    expect(parsed?.content[0].content[0].content[0].attrs.fieldKey).toBe("assessmentArea");
    expect(parsed?.content[0].content[0].content[0].attrs.fieldLabel).toBeUndefined();
  });

  it("keeps a restricted academic-calendar system binding", () => {
    const document = createTableTemplateDocument([
      [{ kind: "text", text: "월", header: true }],
      [{
        kind: "input",
        fieldKey: "calendarMonth",
        fieldLabel: "월",
        inputKind: "text",
        inputSource: "system",
        systemValue: "academic_calendar.month",
      }],
    ]);

    const cell = document.content[0].content[1].content[0];
    expect(cell.attrs).toMatchObject({
      inputSource: "system",
      systemValue: "academic_calendar.month",
    });
    expect(parseTableTemplateDocument(document)).toEqual(document);
  });

  it("rejects a system binding attached to a teacher-entered cell", () => {
    const document = createTableTemplateDocument([[{
      kind: "input",
      fieldKey: "month",
      fieldLabel: "월",
      inputKind: "text",
      inputSource: "teacher",
    }]]);
    const invalid = structuredClone(document) as unknown as {
      content: Array<{ content: Array<{ content: Array<{ attrs: Record<string, unknown> }> }> }>;
    };
    invalid.content[0].content[0].content[0].attrs.systemValue = "academic_calendar.month";

    expect(parseTableTemplateDocument(invalid)).toBeUndefined();
  });

  it("maps logical columns correctly across rowspans and colspans", () => {
    const document = createTableTemplateDocument([
      [
        { kind: "text", text: "A", rowspan: 2 },
        { kind: "text", text: "B-C", colspan: 2 },
      ],
      [
        { kind: "text", text: "B" },
        { kind: "text", text: "C" },
      ],
    ]);

    expect(getTableTemplateCellPlacements(document)).toEqual([
      [
        { cellIndex: 0, startColumn: 0, endColumn: 1 },
        { cellIndex: 1, startColumn: 1, endColumn: 3 },
      ],
      [
        { cellIndex: 0, startColumn: 1, endColumn: 2 },
        { cellIndex: 1, startColumn: 2, endColumn: 3 },
      ],
    ]);
  });

  it("combines widths from all rows and keeps unspecified columns visible", () => {
    const document = createTableTemplateDocument([
      [
        { kind: "text", text: "A", colwidth: [100] },
        { kind: "text", text: "B" },
        { kind: "text", text: "C" },
      ],
      [
        { kind: "text", text: "D" },
        { kind: "text", text: "E", colwidth: [200] },
        { kind: "text", text: "F" },
      ],
    ]);

    expect(getTableTemplateColumnWidths(document)).toEqual([100, 200, 150]);
    const reloaded = parseTableTemplateDocument(JSON.parse(JSON.stringify(document)));
    expect(reloaded && getTableTemplateColumnWidths(reloaded)).toEqual([100, 200, 150]);
  });

  it("keeps every logical column automatic when no row has a width", () => {
    const document = createTableTemplateDocument([
      [{ kind: "text", text: "A" }, { kind: "text", text: "B" }],
      [{ kind: "text", text: "C" }, { kind: "text", text: "D" }],
    ]);

    expect(getTableTemplateColumnWidths(document)).toEqual([null, null]);
  });

  it("maps widths through merged cells and rowspans", () => {
    const document = createTableTemplateDocument([
      [
        { kind: "text", text: "A", rowspan: 2, colwidth: [90] },
        { kind: "text", text: "B-C", colspan: 2, colwidth: [180, 120] },
      ],
      [{ kind: "text", text: "D", colwidth: [180] }, { kind: "text", text: "E", colwidth: [120] }],
    ]);

    expect(getTableTemplateColumnWidths(document)).toEqual([90, 180, 120]);
  });

  it.each([
    { widths: [120, 0], rendered: [120, 120] },
    { widths: [0, 120], rendered: [120, 120] },
    { widths: [0, 0], rendered: [null, null] },
  ])("round-trips ProseMirror's unspecified widths $widths", ({ widths, rendered }) => {
    const parsed = parseTableTemplateDocument(documentWithColwidth(widths));
    expect(parsed?.content[0].content[0].content[0].attrs.colwidth).toEqual(widths);
    expect(parsed && getTableTemplateColumnWidths(parsed)).toEqual(rendered);
    const reloaded = parseTableTemplateDocument(JSON.parse(JSON.stringify(parsed)));
    expect(reloaded && getTableTemplateColumnWidths(reloaded)).toEqual(rendered);
  });

  it.each([{ widths: [-1] }, { widths: [1] }, { widths: [19] }])("continues to reject invalid small widths $widths", ({ widths }) => {
    expect(parseTableTemplateDocument(documentWithColwidth(widths))).toBeUndefined();
  });

  it("accepts long plain-text criteria inside a table cell", () => {
    const longText = "평가기준".repeat(300);
    const parsed = parseTableTemplateDocument({
      type: "doc",
      content: [{
        type: "table",
        content: [{
          type: "tableRow",
          content: [{
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [{
              type: "paragraph",
              content: [{ type: "text", text: longText }],
            }],
          }],
        }],
      }],
    });

    expect(parsed).toBeDefined();
  });

  it("rejects rich editor nodes that are not part of the table template contract", () => {
    expect(parseTableTemplateDocument({
      type: "doc",
      content: [{
        type: "table",
        content: [{
          type: "tableRow",
          content: [{
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: null },
            content: [{
              type: "paragraph",
              content: [{ type: "image", src: "https://example.com/image.png" }],
            }],
          }],
        }],
      }],
    })).toBeUndefined();
  });

  it("rejects static text inside a bound input cell", () => {
    expect(parseTableTemplateDocument({
      type: "doc",
      content: [{
        type: "table",
        content: [{
          type: "tableRow",
          content: [{
            type: "tableCell",
            attrs: {
              colspan: 1,
              rowspan: 1,
              colwidth: null,
              fieldKey: "assessmentArea",
              fieldLabel: "평가 영역",
              inputKind: "text",
              inputSource: "teacher",
            },
            content: [{
              type: "paragraph",
              content: [{ type: "text", text: "고정 문구" }],
            }],
          }],
        }],
      }],
    })).toBeUndefined();
  });

  it("rejects a table row that leaves a logical column empty", () => {
    expect(parseTableTemplateDocument({
      type: "doc",
      content: [{
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              cell("A"),
              cell("B"),
            ],
          },
          {
            type: "tableRow",
            content: [cell("only one cell")],
          },
        ],
      }],
    })).toBeUndefined();
  });

  it("rejects a rowspan that extends past the last table row", () => {
    expect(parseTableTemplateDocument({
      type: "doc",
      content: [{
        type: "table",
        content: [{
          type: "tableRow",
          content: [{
            ...cell("A"),
            attrs: { colspan: 1, rowspan: 2, colwidth: null },
          }],
        }],
      }],
    })).toBeUndefined();
  });
});

function documentWithColwidth(widths: number[]) {
  return {
    type: "doc",
    content: [{
      type: "table",
      content: [{
        type: "tableRow",
        content: [{
          type: "tableCell",
          attrs: { colspan: widths.length, rowspan: 1, colwidth: widths },
          content: [{ type: "paragraph" }],
        }],
      }],
    }],
  };
}

function cell(text: string) {
  return {
    type: "tableCell",
    attrs: { colspan: 1, rowspan: 1, colwidth: null },
    content: [{
      type: "paragraph",
      content: [{ type: "text", text }],
    }],
  };
}
