"use client";

import { Extension, type Editor } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import type { ResolvedPos } from "@tiptap/pm/model";
import {
  CellSelection,
  cellAround,
  mergeCells as mergeTableCells,
  splitCell as splitTableCell,
} from "@tiptap/pm/tables";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";

import {
  parseTableTemplateDocument,
  type TableTemplateDocument,
  type TableTemplateInputKind,
  type TableTemplateInputSource,
  type TableTemplateSystemValue,
} from "../domain/table-template";
import {
  changeTableTemplateCellBindingSource,
  createCustomTableTemplateCellBinding,
  type TableTemplateCellBinding,
} from "../domain/table-template-binding";
import styles from "./TableTemplateEditor.module.css";

type TableTemplateEditorProps = {
  document: TableTemplateDocument;
  editable?: boolean;
  compact?: boolean;
  onChange: (document: TableTemplateDocument) => void;
};

const inputKindLabels: Record<TableTemplateInputKind, string> = {
  text: "짧은 글",
  multiline: "여러 줄 글",
  number: "숫자",
  percentage: "백분율",
  achievement_standards: "성취기준 선택",
  bullet_list: "목록",
  checkbox_list: "여러 항목 선택",
};

const inputSourceLabels: Record<TableTemplateInputSource, string> = {
  system: "시스템에서 자동으로 채움",
  teacher: "교과 담당자가 입력",
  custom: "교과 담당자가 입력 (학교 추가 항목)",
};

const TableFieldAttributes = Extension.create({
  name: "pyungaTableFieldAttributes",
  addGlobalAttributes() {
    return [{
      types: ["tableCell", "tableHeader"],
      attributes: {
        fieldKey: dataAttribute("data-field-key"),
        fieldLabel: dataAttribute("data-field-label"),
        inputKind: dataAttribute("data-input-kind"),
        inputSource: dataAttribute("data-input-source"),
        systemValue: dataAttribute("data-system-value"),
        required: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-required") === "true" ? true : null,
          renderHTML: (attributes) => attributes.required === true ? { "data-required": "true" } : {},
        },
      },
    }];
  },
});

export function TableTemplateEditor({
  document,
  editable = true,
  compact = false,
  onChange,
}: TableTemplateEditorProps) {
  const [, setSelectionRevision] = useState(0);
  const [editorError, setEditorError] = useState<string>();
  const lastValidDocumentRef = useRef(document);
  const onChangeRef = useRef(onChange);
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        listItem: false,
        listKeymap: false,
        link: false,
        orderedList: false,
        strike: false,
        trailingNode: false,
        underline: false,
      }),
      TableKit.configure({
        table: {
          resizable: true,
          lastColumnResizable: true,
          cellMinWidth: 56,
        },
      }),
      TableFieldAttributes,
    ],
    content: document,
    editorProps: {
      handleTextInput(view, from) {
        return isBoundCellPosition(view.state.doc.resolve(from));
      },
      handlePaste(view) {
        return isBoundCellPosition(view.state.selection.$from);
      },
      handleKeyDown(view, event) {
        if (!isBoundCellPosition(view.state.selection.$from)) return false;
        return event.key === "Enter" || event.key === "Backspace" || event.key === "Delete";
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const parsed = parseTableTemplateDocument(currentEditor.getJSON());
      if (parsed) {
        lastValidDocumentRef.current = parsed;
        setEditorError(undefined);
        onChangeRef.current(parsed);
        return;
      }
      setEditorError("표에서 지원하지 않는 형식이 입력되어 마지막 정상 상태로 되돌렸습니다.");
      currentEditor.commands.setContent(lastValidDocumentRef.current, { emitUpdate: false });
    },
    onSelectionUpdate: () => setSelectionRevision((value) => value + 1),
  });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) return;
    lastValidDocumentRef.current = document;
    const current = parseTableTemplateDocument(editor.getJSON());
    if (current && JSON.stringify(current) === JSON.stringify(document)) return;
    editor.commands.setContent(document, { emitUpdate: false });
  }, [document, editor]);

  if (!editor) {
    return <div className={styles.loading}>표 편집기를 준비하는 중입니다.</div>;
  }

  const selection = readSelectedCell(editor);
  const inTable = editor.isActive("table");
  const mergeIssue = getMergeIssue(editor);
  const headerToggleIssue = getHeaderToggleIssue(editor);

  return (
    <div className={`${styles.editorShell} ${compact ? styles.compact : ""}`}>
      <div className={styles.toolbar} aria-label="표 편집 도구">
        <ToolbarButton label="실행 취소" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton label="다시 실행" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />
        <span className={styles.toolbarDivider} />
        <ToolbarButton label="위에 행" disabled={!editor.can().addRowBefore()} onClick={() => run(editor, "addRowBefore")} />
        <ToolbarButton label="아래에 행" disabled={!editor.can().addRowAfter()} onClick={() => run(editor, "addRowAfter")} />
        <ToolbarButton label="왼쪽 열" disabled={!editor.can().addColumnBefore()} onClick={() => run(editor, "addColumnBefore")} />
        <ToolbarButton label="오른쪽 열" disabled={!editor.can().addColumnAfter()} onClick={() => run(editor, "addColumnAfter")} />
        <span className={styles.toolbarDivider} />
        <ToolbarButton label="행 삭제" disabled={!editor.can().deleteRow()} onClick={() => run(editor, "deleteRow")} />
        <ToolbarButton label="열 삭제" disabled={!editor.can().deleteColumn()} onClick={() => run(editor, "deleteColumn")} />
        <span className={styles.toolbarDivider} />
        <ToolbarButton
          label="셀 합치기"
          disabled={!editor.can().mergeCells() || Boolean(mergeIssue)}
          onClick={() => mergeCellsSafely(editor)}
        />
        <ToolbarButton
          label="셀 나누기"
          disabled={!editor.can().splitCell()}
          onClick={() => splitCellSafely(editor)}
        />
        <ToolbarButton
          label="첫 행 머리글 전환"
          disabled={!editor.can().toggleHeaderRow() || Boolean(headerToggleIssue)}
          onClick={() => run(editor, "toggleHeaderRow")}
        />
      </div>

      <p className={styles.guide}>
        일반 셀의 글자는 바로 수정할 수 있습니다. 여러 셀을 드래그해 선택한 뒤 합칠 수 있고, 열 경계를 드래그하면 폭을 조절할 수 있습니다.
        데이터 칸은 교과 담당자가 입력하거나 학사일정에서 자동으로 채울 자리이므로 고정 문구를 입력하지 않습니다.
      </p>
      {mergeIssue ? <p className={styles.operationWarning}>{mergeIssue}</p> : null}
      {!mergeIssue && headerToggleIssue ? <p className={styles.operationWarning}>{headerToggleIssue}</p> : null}
      {editorError ? <p className={styles.operationWarning}>{editorError}</p> : null}

      <div className={styles.tableViewport}>
        <EditorContent editor={editor} className={styles.editorContent} />
      </div>

      {inTable && selection ? (
        <SelectedCellControls
          editor={editor}
          selection={selection}
        />
      ) : (
        <p className={styles.selectionHint}>표의 셀을 선택하면 해당 셀의 입력 방식을 지정할 수 있습니다.</p>
      )}
    </div>
  );
}

type SelectedCell = {
  nodeType: "tableCell" | "tableHeader";
  fieldKey?: string;
  fieldLabel?: string;
  inputKind: TableTemplateInputKind;
  inputSource: TableTemplateInputSource;
  systemValue?: TableTemplateSystemValue;
  required: boolean;
};

function SelectedCellControls({
  editor,
  selection,
}: {
  editor: Editor;
  selection: SelectedCell;
}) {
  const isInput = Boolean(selection.fieldKey);

  function makeInputCell() {
    if (isInput || selection.nodeType === "tableHeader") return;
    convertSelectedCellToInput(editor);
  }

  function makeTextCell() {
    if (!isInput) return;
    if (
      !window.confirm(
        `‘${selection.fieldLabel ?? "교과 입력"}’ 입력 연결을 해제하고 일반 셀로 바꾸시겠습니까? 실행 취소로 되돌릴 수 있습니다.`,
      )
    ) {
      return;
    }
    applyBindingToEditor(editor);
  }

  return (
    <div className={styles.cellControls}>
      <div className={styles.cellControlsHeader}>
        <strong>선택한 셀</strong>
        <div className={styles.cellKindToggle}>
          <button className={!isInput ? styles.activeKind : ""} type="button" onClick={makeTextCell}>일반 셀</button>
          <button className={isInput ? styles.activeKind : ""} type="button" disabled={selection.nodeType === "tableHeader"} onClick={makeInputCell}>
            데이터 칸
          </button>
        </div>
      </div>

      {isInput ? (
        <div className={styles.cellOptionGrid}>
          <label className="field">
            <span>입력 항목 이름</span>
            <input
              value={selection.fieldLabel ?? ""}
              onChange={(event) => editor.commands.setCellAttribute("fieldLabel", event.target.value)}
              onBlur={(event) => {
                if (event.currentTarget.value.trim().length === 0) {
                  editor.commands.setCellAttribute("fieldLabel", "입력 항목");
                }
              }}
            />
          </label>
          <label className="field">
            <span>입력 형식</span>
            <select
              value={selection.inputKind}
              onChange={(event) =>
                editor.commands.setCellAttribute(
                  "inputKind",
                  parseInputKind(event.target.value),
                )
              }
            >
              {Object.entries(inputKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>값 입력 방식</span>
            <select
              value={selection.inputSource}
              onChange={(event) => {
                const inputSource = parseInputSource(event.target.value);
                const binding = selectedCellToBinding(selection);
                if (binding) {
                  applyBindingToEditor(
                    editor,
                    changeTableTemplateCellBindingSource(binding, inputSource),
                  );
                }
              }}
            >
              {selection.inputSource === "system" ? (
                <option value="system" disabled>시스템 자동 입력 (교수학습표 전용)</option>
              ) : null}
              {Object.entries(inputSourceLabels)
                .filter(([value]) => value !== "system")
                .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={styles.requiredField}>
            <input
              type="checkbox"
              checked={selection.required}
              onChange={(event) =>
                editor.commands.setCellAttribute("required", event.target.checked)
              }
            />
            <span>필수 입력</span>
          </label>
        </div>
      ) : (
        <p className={styles.cellHelp}>제목이나 안내 문구는 셀 안에서 바로 입력하세요. 교과 입력값이나 학사일정 자동값이 들어갈 칸만 ‘데이터 칸’으로 지정하면 됩니다.</p>
      )}
    </div>
  );
}

function ToolbarButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return <button type="button" disabled={disabled} onClick={onClick}>{label}</button>;
}

type TableCommand =
  | "addRowBefore"
  | "addRowAfter"
  | "addColumnBefore"
  | "addColumnAfter"
  | "deleteRow"
  | "deleteColumn"
  | "toggleHeaderRow";

function run(editor: Editor, command: TableCommand) {
  const chain = editor.chain().focus();
  switch (command) {
    case "addRowBefore": chain.addRowBefore().run(); break;
    case "addRowAfter": chain.addRowAfter().run(); break;
    case "addColumnBefore": chain.addColumnBefore().run(); break;
    case "addColumnAfter": chain.addColumnAfter().run(); break;
    case "deleteRow": chain.deleteRow().run(); break;
    case "deleteColumn": chain.deleteColumn().run(); break;
    case "toggleHeaderRow": chain.toggleHeaderRow().run(); break;
  }
}

function convertSelectedCellToInput(editor: Editor) {
  const selection = editor.state.selection;
  const resolvedCell = selection instanceof CellSelection
    ? selection.$anchorCell
    : cellAround(selection.$from);
  const cell = resolvedCell?.nodeAfter;
  if (!resolvedCell || !cell || cell.type.name !== "tableCell") return;

  const suffix = createFieldSuffix();
  const binding = createCustomTableTemplateCellBinding(`custom.${suffix}`);
  const paragraph = editor.schema.nodes.paragraph.create();
  const replacement = cell.type.create(
    {
      ...cell.attrs,
      ...bindingToEditorAttrs(binding),
    },
    paragraph,
  );
  const transaction = editor.state.tr.replaceWith(
    resolvedCell.pos,
    resolvedCell.pos + cell.nodeSize,
    replacement,
  );
  editor.view.dispatch(transaction);
  editor.view.focus();
}

function isBoundCellPosition(position: ResolvedPos): boolean {
  const cell = cellAround(position)?.nodeAfter;
  return typeof cell?.attrs.fieldKey === "string" && cell.attrs.fieldKey.length > 0;
}

type SelectedBinding = {
  fieldKey: string;
  fieldLabel: string | null;
  inputKind: TableTemplateInputKind;
  inputSource: TableTemplateInputSource;
  systemValue: TableTemplateSystemValue | null;
  required: boolean | null;
};

function getMergeIssue(editor: Editor): string | undefined {
  const selection = editor.state.selection;
  if (!(selection instanceof CellSelection) || selection.$anchorCell.pos === selection.$headCell.pos) return undefined;

  let boundCellCount = 0;
  let nonEmptyPlainCellCount = 0;
  selection.forEachCell((node) => {
    if (readBindingFromAttrs(node.attrs)) {
      boundCellCount += 1;
    } else if (node.textContent.trim().length > 0) {
      nonEmptyPlainCellCount += 1;
    }
  });

  if (boundCellCount > 1) {
    return "서로 다른 데이터 칸은 한 셀로 합칠 수 없습니다.";
  }
  if (boundCellCount === 1 && nonEmptyPlainCellCount > 0) {
    return "데이터 칸과 글자가 있는 제목 셀은 바로 합칠 수 없습니다. 제목을 비운 뒤 합쳐 주세요.";
  }
  return undefined;
}

function getHeaderToggleIssue(editor: Editor): string | undefined {
  const document = parseTableTemplateDocument(editor.getJSON());
  if (!document) return undefined;
  const firstRow = document.content[0].content[0];
  const hasBoundCell = firstRow.content.some((cell) => Boolean(cell.attrs.fieldKey));
  return hasBoundCell
    ? "데이터 칸이 있는 첫 행은 머리글 행으로 전환할 수 없습니다."
    : undefined;
}

function mergeCellsSafely(editor: Editor) {
  if (getMergeIssue(editor)) return;
  const selection = editor.state.selection;
  if (!(selection instanceof CellSelection)) return;

  let binding: SelectedBinding | undefined;
  selection.forEachCell((node) => {
    binding ??= readBindingFromAttrs(node.attrs);
  });

  editor.view.focus();
  mergeTableCells(editor.state, (transaction) => {
    if (binding && transaction.selection instanceof CellSelection) {
      const position = transaction.selection.$anchorCell.pos;
      const node = transaction.doc.nodeAt(position);
      if (node) {
        transaction.setNodeMarkup(position, undefined, {
          ...node.attrs,
          fieldKey: binding.fieldKey,
          fieldLabel: binding.fieldLabel,
          inputKind: binding.inputKind,
          inputSource: binding.inputSource,
          systemValue: binding.systemValue,
          required: binding.required,
        });
      }
    }
    editor.view.dispatch(transaction);
  });
}

function splitCellSafely(editor: Editor) {
  const binding = readSelectedCell(editor)?.fieldKey
    ? readBindingFromActiveCell(editor)
    : undefined;
  const originalCellPosition = cellAround(editor.state.selection.$from)?.pos;

  editor.view.focus();
  splitTableCell(editor.state, (transaction) => {
    if (binding) {
      const boundPositions: number[] = [];
      transaction.doc.descendants((node, position) => {
        if (
          (node.type.name === "tableCell" || node.type.name === "tableHeader")
          && node.attrs.fieldKey === binding.fieldKey
        ) {
          boundPositions.push(position);
        }
      });
      const keepPosition = boundPositions.reduce<number | undefined>((best, position) => {
        if (best === undefined || originalCellPosition === undefined) return best ?? position;
        return Math.abs(position - originalCellPosition) < Math.abs(best - originalCellPosition)
          ? position
          : best;
      }, undefined);
      for (const position of boundPositions) {
        if (position === keepPosition) continue;
        const node = transaction.doc.nodeAt(position);
        if (!node) continue;
        transaction.setNodeMarkup(position, undefined, {
          ...node.attrs,
          fieldKey: null,
          fieldLabel: null,
          inputKind: null,
          inputSource: null,
          systemValue: null,
          required: null,
        });
      }
    }
    editor.view.dispatch(transaction);
  });
}

function readSelectedCell(editor: Editor): SelectedCell | undefined {
  const currentSelection = editor.state.selection;
  if (
    currentSelection instanceof CellSelection
    && (
      currentSelection.ranges.length > 1
      || currentSelection.$anchorCell.pos !== currentSelection.$headCell.pos
    )
  ) {
    return undefined;
  }
  const nodeType = editor.isActive("tableHeader")
    ? "tableHeader"
    : editor.isActive("tableCell")
      ? "tableCell"
      : undefined;
  if (!nodeType) return undefined;
  const attrs = editor.getAttributes(nodeType);
  return {
    nodeType,
    fieldKey: readOptionalString(attrs.fieldKey),
    fieldLabel: readOptionalString(attrs.fieldLabel),
    inputKind: parseInputKind(attrs.inputKind),
    inputSource: parseInputSource(attrs.inputSource),
    systemValue: parseOptionalSystemValue(attrs.systemValue),
    required: attrs.required === true,
  };
}

function readBindingFromActiveCell(editor: Editor): SelectedBinding | undefined {
  const nodeType = editor.isActive("tableHeader")
    ? "tableHeader"
    : editor.isActive("tableCell")
      ? "tableCell"
      : undefined;
  return nodeType ? readBindingFromAttrs(editor.getAttributes(nodeType)) : undefined;
}

function readBindingFromAttrs(attrs: Record<string, unknown>): SelectedBinding | undefined {
  const fieldKey = readOptionalString(attrs.fieldKey);
  if (!fieldKey) return undefined;
  return {
    fieldKey,
    fieldLabel: readOptionalString(attrs.fieldLabel) ?? null,
    inputKind: parseInputKind(attrs.inputKind),
    inputSource: parseInputSource(attrs.inputSource),
    systemValue: parseOptionalSystemValue(attrs.systemValue) ?? null,
    required: typeof attrs.required === "boolean" ? attrs.required : null,
  };
}

function selectedCellToBinding(selection: SelectedCell): TableTemplateCellBinding | undefined {
  if (!selection.fieldKey) return undefined;
  return {
    fieldKey: selection.fieldKey,
    fieldLabel: selection.fieldLabel ?? "입력 항목",
    inputKind: selection.inputKind,
    inputSource: selection.inputSource,
    ...(selection.inputSource === "system" && selection.systemValue
      ? { systemValue: selection.systemValue }
      : {}),
    required: selection.required,
  };
}

function applyBindingToEditor(editor: Editor, binding?: TableTemplateCellBinding) {
  const attrs = bindingToEditorAttrs(binding);
  editor.chain()
    .focus()
    .setCellAttribute("fieldKey", attrs.fieldKey)
    .setCellAttribute("fieldLabel", attrs.fieldLabel)
    .setCellAttribute("inputKind", attrs.inputKind)
    .setCellAttribute("inputSource", attrs.inputSource)
    .setCellAttribute("systemValue", attrs.systemValue)
    .setCellAttribute("required", attrs.required)
    .run();
}

function bindingToEditorAttrs(binding?: TableTemplateCellBinding) {
  return {
    fieldKey: binding?.fieldKey ?? null,
    fieldLabel: binding?.fieldLabel ?? null,
    inputKind: binding?.inputKind ?? null,
    inputSource: binding?.inputSource ?? null,
    systemValue: binding?.inputSource === "system" ? binding.systemValue ?? null : null,
    required: binding?.required ?? null,
  };
}

function dataAttribute(attributeName: string) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute(attributeName),
    renderHTML: (attributes: Record<string, unknown>) => {
      const key = attributeName.replace(/^data-/, "").replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      const value = attributes[key];
      return typeof value === "string" && value ? { [attributeName]: value } : {};
    },
  };
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseInputKind(value: unknown): TableTemplateInputKind {
  switch (value) {
    case "multiline": return "multiline";
    case "number": return "number";
    case "percentage": return "percentage";
    case "achievement_standards": return "achievement_standards";
    case "bullet_list": return "bullet_list";
    case "checkbox_list": return "checkbox_list";
    default: return "text";
  }
}

function parseInputSource(value: unknown): TableTemplateInputSource {
  if (value === "system") return "system";
  if (value === "custom") return "custom";
  return "teacher";
}

function parseOptionalSystemValue(value: unknown): TableTemplateSystemValue | undefined {
  switch (value) {
    case "academic_calendar.period": return value;
    case "academic_calendar.month": return value;
    case "academic_calendar.week": return value;
    case "academic_calendar.date_range": return value;
    case "academic_calendar.events": return value;
    default: return undefined;
  }
}

function createFieldSuffix(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}
