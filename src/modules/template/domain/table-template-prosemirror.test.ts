import { Schema } from "@tiptap/pm/model";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import {
  addColumnAfter,
  CellSelection,
  deleteColumn,
  mergeCells,
  splitCell,
  TableMap,
  tableNodes,
} from "@tiptap/pm/tables";
import { describe, expect, it } from "vitest";

import {
  createTableTemplateDocument,
  getTableTemplateColumnWidths,
  parseTableTemplateDocument,
} from "./table-template";

const tableSpecs = tableNodes({ tableGroup: "block", cellContent: "paragraph+", cellAttributes: {} });
const editorSchema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "text*" },
    text: {},
    table: { ...tableSpecs.table, content: "tableRow+" },
    tableRow: { ...tableSpecs.table_row, content: "(tableCell | tableHeader)*" },
    tableCell: tableSpecs.table_cell,
    tableHeader: tableSpecs.table_header,
  },
});

describe("table template ProseMirror width compatibility", () => {
  it("keeps merge, split, add/remove column and save/reload valid with zero sentinels", () => {
    const document = createTableTemplateDocument([
      [
        { kind: "text", text: "A", colwidth: [120] },
        { kind: "text", text: "B" },
      ],
      [
        { kind: "text", text: "C", colwidth: [120] },
        { kind: "text", text: "D" },
      ],
    ]);
    let state = EditorState.create({ doc: editorSchema.nodeFromJSON(document) });

    state = selectCells(state, 0, 1);
    state = applyTableCommand(state, mergeCells);
    const merged = parseTableTemplateDocument(state.doc.toJSON());
    expect(merged?.content[0].content[0].content[0].attrs.colwidth).toEqual([120, 0]);
    expect(merged && getTableTemplateColumnWidths(merged)).toEqual([120, 120]);
    const reloaded = parseTableTemplateDocument(JSON.parse(JSON.stringify(merged)));
    expect(reloaded && getTableTemplateColumnWidths(reloaded)).toEqual([120, 120]);

    state = selectCells(state, 0);
    state = applyTableCommand(state, splitCell);
    expect(parseTableTemplateDocument(state.doc.toJSON())).toBeDefined();

    state = selectCells(state, 0);
    state = applyTableCommand(state, addColumnAfter);
    expect(parseTableTemplateDocument(state.doc.toJSON())).toBeDefined();

    state = selectCells(state, 2);
    state = applyTableCommand(state, deleteColumn);
    const afterDelete = parseTableTemplateDocument(state.doc.toJSON());
    expect(afterDelete).toBeDefined();
    expect(afterDelete && getTableTemplateColumnWidths(afterDelete)).toHaveLength(2);
  });
});

function selectCells(state: EditorState, anchorCell: number, headCell = anchorCell): EditorState {
  const table = state.doc.firstChild;
  if (!table) throw new Error("Expected a table in the document.");
  const map = TableMap.get(table);
  const selection = CellSelection.create(
    state.doc,
    1 + map.map[anchorCell],
    1 + map.map[headCell],
  );
  return state.apply(state.tr.setSelection(selection));
}

function applyTableCommand(
  state: EditorState,
  command: (state: EditorState, dispatch?: (transaction: Transaction) => void) => boolean,
): EditorState {
  const transactions: Transaction[] = [];
  expect(command(state, (transaction) => transactions.push(transaction))).toBe(true);
  if (!transactions[0]) throw new Error("Expected the table command to dispatch a transaction.");
  return state.apply(transactions[0]);
}
