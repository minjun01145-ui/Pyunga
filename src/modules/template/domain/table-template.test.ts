import { describe, expect, it } from "vitest";

import {
  createTableTemplateDocument,
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
