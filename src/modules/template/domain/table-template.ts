export type TableTemplateInputKind =
  | "text"
  | "multiline"
  | "number"
  | "percentage"
  | "achievement_standards"
  | "bullet_list"
  | "checkbox_list";

export type TableTemplateInputSource = "system" | "teacher" | "custom";

export type TableTemplateSystemValue =
  | "academic_calendar.period"
  | "academic_calendar.month"
  | "academic_calendar.week"
  | "academic_calendar.date_range"
  | "academic_calendar.events";

export type TableTemplateCellAttrs = {
  colspan: number;
  rowspan: number;
  colwidth: number[] | null;
  fieldKey?: string;
  fieldLabel?: string;
  inputKind?: TableTemplateInputKind;
  inputSource?: TableTemplateInputSource;
  systemValue?: TableTemplateSystemValue;
  required?: boolean;
};

export type TableTemplateTextNode = {
  type: "text";
  text: string;
};

export type TableTemplateParagraphNode = {
  type: "paragraph";
  content?: TableTemplateTextNode[];
};

export type TableTemplateCellNode = {
  type: "tableCell" | "tableHeader";
  attrs: TableTemplateCellAttrs;
  content: TableTemplateParagraphNode[];
};

export type TableTemplateRowNode = {
  type: "tableRow";
  content: TableTemplateCellNode[];
};

export type TableTemplateNode = {
  type: "table";
  content: TableTemplateRowNode[];
};

export type TableTemplateDocument = {
  type: "doc";
  content: [TableTemplateNode];
};

export type TableTemplateCellDraft = {
  kind: "text" | "input";
  text?: string;
  fieldKey?: string;
  fieldLabel?: string;
  inputKind?: TableTemplateInputKind;
  inputSource?: TableTemplateInputSource;
  systemValue?: TableTemplateSystemValue;
  required?: boolean;
  header?: boolean;
  colspan?: number;
  rowspan?: number;
  colwidth?: number[] | null;
};

const MAX_ROWS = 60;
const MAX_CELLS_PER_ROW = 30;
const MAX_LOGICAL_COLUMNS = 30;
const MAX_TEXT_LENGTH = 10_000;
const MAX_PARAGRAPHS_PER_CELL = 120;
const MAX_CELL_TEXT_LENGTH = 10_000;

export function parseTableTemplateDocument(value: unknown): TableTemplateDocument | undefined {
  if (!isRecord(value) || value.type !== "doc" || !Array.isArray(value.content) || value.content.length !== 1) {
    return undefined;
  }
  const table = parseTableNode(value.content[0]);
  return table ? { type: "doc", content: [table] } : undefined;
}

export function createTableTemplateDocument(
  rows: readonly (readonly TableTemplateCellDraft[])[],
): TableTemplateDocument {
  const normalizedRows = rows.length > 0 ? rows : [[{ kind: "text", text: "" } as const]];
  return {
    type: "doc",
    content: [{
      type: "table",
      content: normalizedRows.map((row): TableTemplateRowNode => ({
        type: "tableRow",
        content: (row.length > 0 ? row : [{ kind: "text", text: "" } as const]).map(createCellFromDraft),
      })),
    }],
  };
}

export function tableTemplateCellText(cell: TableTemplateCellNode): string {
  return cell.content
    .flatMap((paragraph) => paragraph.content ?? [])
    .map((textNode) => textNode.text)
    .join("");
}

export function getTableTemplateFieldKeys(document: TableTemplateDocument): string[] {
  const keys: string[] = [];
  for (const row of document.content[0].content) {
    for (const cell of row.content) {
      if (cell.attrs.fieldKey && !keys.includes(cell.attrs.fieldKey)) keys.push(cell.attrs.fieldKey);
    }
  }
  return keys;
}

export function getTableTemplateLeadingHeaderRowCount(document: TableTemplateDocument): number {
  let count = 0;
  for (const row of document.content[0].content) {
    if (!row.content.every((cell) => cell.type === "tableHeader")) break;
    count += 1;
  }
  return count;
}

export function getTableTemplateColumnWidths(document: TableTemplateDocument): Array<number | null> {
  const widths: Array<number | null> = [];
  for (const cell of document.content[0].content[0].content) {
    for (let index = 0; index < cell.attrs.colspan; index += 1) {
      widths.push(cell.attrs.colwidth?.[index] ?? null);
    }
  }
  return widths;
}

function createCellFromDraft(draft: TableTemplateCellDraft): TableTemplateCellNode {
  const text = draft.kind === "input" ? "" : draft.text ?? "";
  const fieldKey = draft.kind === "input" && !draft.header ? draft.fieldKey : undefined;
  const colspan = clampSpan(draft.colspan);
  const attrs: TableTemplateCellAttrs = {
    colspan,
    rowspan: clampSpan(draft.rowspan),
    colwidth: normalizeColwidth(draft.colwidth, colspan),
    ...(fieldKey ? {
      fieldKey,
      fieldLabel: draft.fieldLabel?.trim() || "입력",
      inputKind: draft.inputKind ?? "text",
      inputSource: draft.inputSource ?? "teacher",
      ...((draft.inputSource ?? "teacher") === "system" && draft.systemValue
        ? { systemValue: draft.systemValue }
        : {}),
      ...(draft.required === undefined ? {} : { required: draft.required }),
    } : {}),
  };
  return {
    type: draft.header ? "tableHeader" : "tableCell",
    attrs,
    content: [{
      type: "paragraph",
      ...(text ? { content: [{ type: "text", text }] } : {}),
    }],
  };
}

function parseTableNode(value: unknown): TableTemplateNode | undefined {
  if (!isRecord(value) || value.type !== "table" || !Array.isArray(value.content)) return undefined;
  if (value.content.length < 1 || value.content.length > MAX_ROWS) return undefined;
  const rows: TableTemplateRowNode[] = [];
  for (const rawRow of value.content) {
    const row = parseRowNode(rawRow);
    if (!row) return undefined;
    rows.push(row);
  }
  if (!hasValidTableGeometry(rows)) return undefined;
  return { type: "table", content: rows };
}

function hasValidTableGeometry(rows: readonly TableTemplateRowNode[]): boolean {
  const logicalColumnCount = rows[0].content.reduce(
    (total, cell) => total + cell.attrs.colspan,
    0,
  );
  if (logicalColumnCount < 1 || logicalColumnCount > MAX_LOGICAL_COLUMNS) {
    return false;
  }

  const occupiedRowsRemaining = Array.from(
    { length: logicalColumnCount },
    () => 0,
  );

  for (const row of rows) {
    for (const cell of row.content) {
      const startColumn = findFreeColumnRange(
        occupiedRowsRemaining,
        cell.attrs.colspan,
      );
      if (startColumn < 0) return false;

      for (
        let columnIndex = startColumn;
        columnIndex < startColumn + cell.attrs.colspan;
        columnIndex += 1
      ) {
        occupiedRowsRemaining[columnIndex] = cell.attrs.rowspan;
      }
    }

    if (occupiedRowsRemaining.some((remaining) => remaining === 0)) {
      return false;
    }

    for (
      let columnIndex = 0;
      columnIndex < occupiedRowsRemaining.length;
      columnIndex += 1
    ) {
      if (occupiedRowsRemaining[columnIndex] > 0) {
        occupiedRowsRemaining[columnIndex] -= 1;
      }
    }
  }

  return occupiedRowsRemaining.every((remaining) => remaining === 0);
}

function findFreeColumnRange(
  occupiedRowsRemaining: readonly number[],
  colspan: number,
): number {
  for (
    let startColumn = 0;
    startColumn <= occupiedRowsRemaining.length - colspan;
    startColumn += 1
  ) {
    let isFree = true;
    for (
      let columnIndex = startColumn;
      columnIndex < startColumn + colspan;
      columnIndex += 1
    ) {
      if (occupiedRowsRemaining[columnIndex] > 0) {
        isFree = false;
        break;
      }
    }
    if (isFree) return startColumn;
  }
  return -1;
}

function parseRowNode(value: unknown): TableTemplateRowNode | undefined {
  if (!isRecord(value) || value.type !== "tableRow" || !Array.isArray(value.content)) return undefined;
  if (value.content.length < 1 || value.content.length > MAX_CELLS_PER_ROW) return undefined;
  const cells: TableTemplateCellNode[] = [];
  for (const rawCell of value.content) {
    const cell = parseCellNode(rawCell);
    if (!cell) return undefined;
    cells.push(cell);
  }
  return { type: "tableRow", content: cells };
}

function parseCellNode(value: unknown): TableTemplateCellNode | undefined {
  if (!isRecord(value) || (value.type !== "tableCell" && value.type !== "tableHeader")) return undefined;
  if (
    !isRecord(value.attrs)
    || !Array.isArray(value.content)
    || value.content.length < 1
    || value.content.length > MAX_PARAGRAPHS_PER_CELL
  ) {
    return undefined;
  }
  const colspan = readSpan(value.attrs.colspan);
  const rowspan = readSpan(value.attrs.rowspan);
  if (!colspan || !rowspan) return undefined;
  const colwidth = parseColwidth(value.attrs.colwidth, colspan);
  if (colwidth === undefined) return undefined;
  const fieldKey = readOptionalFieldKey(value.attrs.fieldKey);
  if (value.attrs.fieldKey !== undefined && value.attrs.fieldKey !== null && fieldKey === undefined) return undefined;
  if (value.type === "tableHeader" && fieldKey) return undefined;
  const fieldLabel = readOptionalText(value.attrs.fieldLabel, 120);
  const inputKind = parseInputKind(value.attrs.inputKind);
  const inputSource = parseInputSource(value.attrs.inputSource);
  const systemValue = parseSystemValue(value.attrs.systemValue);
  const required = value.attrs.required;
  if (fieldKey) {
    if (
      value.attrs.fieldLabel !== undefined
      && value.attrs.fieldLabel !== null
      && value.attrs.fieldLabel !== ""
      && fieldLabel === undefined
    ) return undefined;
    if (value.attrs.inputKind !== undefined && value.attrs.inputKind !== null && inputKind === undefined) return undefined;
    if (value.attrs.inputSource !== undefined && value.attrs.inputSource !== null && inputSource === undefined) return undefined;
    if (value.attrs.systemValue !== undefined && value.attrs.systemValue !== null && systemValue === undefined) return undefined;
    if (required !== undefined && required !== null && typeof required !== "boolean") return undefined;
    if (systemValue && inputSource !== "system") return undefined;
  } else if (
    (value.attrs.fieldLabel !== undefined && value.attrs.fieldLabel !== null)
    || (value.attrs.inputKind !== undefined && value.attrs.inputKind !== null)
    || (value.attrs.inputSource !== undefined && value.attrs.inputSource !== null)
    || (value.attrs.systemValue !== undefined && value.attrs.systemValue !== null)
    || (value.attrs.required !== undefined && value.attrs.required !== null)
  ) {
    return undefined;
  }

  const paragraphs: TableTemplateParagraphNode[] = [];
  for (const rawParagraph of value.content) {
    const paragraph = parseParagraphNode(rawParagraph);
    if (!paragraph) return undefined;
    paragraphs.push(paragraph);
  }
  const textLength = paragraphs
    .flatMap((paragraph) => paragraph.content ?? [])
    .reduce((length, textNode) => length + textNode.text.length, 0);
  if (textLength > MAX_CELL_TEXT_LENGTH) {
    return undefined;
  }
  if (fieldKey && textLength > 0) return undefined;
  return {
    type: value.type,
    attrs: {
      colspan,
      rowspan,
      colwidth,
      ...(fieldKey ? {
        fieldKey,
        ...(fieldLabel ? { fieldLabel } : {}),
        ...(inputKind ? { inputKind } : {}),
        ...(inputSource ? { inputSource } : {}),
        ...(systemValue ? { systemValue } : {}),
        ...(typeof required === "boolean" ? { required } : {}),
      } : {}),
    },
    content: paragraphs,
  };
}

function parseParagraphNode(value: unknown): TableTemplateParagraphNode | undefined {
  if (!isRecord(value) || value.type !== "paragraph") return undefined;
  if (value.content === undefined) return { type: "paragraph" };
  if (!Array.isArray(value.content) || value.content.length > 20) return undefined;
  const textNodes: TableTemplateTextNode[] = [];
  let totalLength = 0;
  for (const rawText of value.content) {
    if (!isRecord(rawText) || rawText.type !== "text" || typeof rawText.text !== "string") return undefined;
    totalLength += rawText.text.length;
    if (totalLength > MAX_TEXT_LENGTH) return undefined;
    textNodes.push({ type: "text", text: rawText.text });
  }
  return textNodes.length > 0
    ? { type: "paragraph", content: textNodes }
    : { type: "paragraph" };
}

function parseColwidth(value: unknown, colspan: number): number[] | null | undefined {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value) || value.length !== colspan) return undefined;
  const widths: number[] = [];
  for (const rawWidth of value) {
    if (typeof rawWidth !== "number" || !Number.isFinite(rawWidth) || rawWidth < 20 || rawWidth > 4000) {
      return undefined;
    }
    widths.push(Math.round(rawWidth));
  }
  return widths;
}

function normalizeColwidth(
  value: number[] | null | undefined,
  colspan: number,
): number[] | null {
  if (!value || value.length !== colspan) return null;
  return value.map((width) => Math.max(20, Math.min(4000, Math.round(width))));
}

function readSpan(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 30
    ? value
    : undefined;
}

function clampSpan(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.min(30, Math.trunc(value)))
    : 1;
}

function readOptionalFieldKey(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,99}$/.test(value)
    ? value
    : undefined;
}

function readOptionalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function parseInputKind(value: unknown): TableTemplateInputKind | undefined {
  switch (value) {
    case "text": return "text";
    case "multiline": return "multiline";
    case "number": return "number";
    case "percentage": return "percentage";
    case "achievement_standards": return "achievement_standards";
    case "bullet_list": return "bullet_list";
    case "checkbox_list": return "checkbox_list";
    default: return undefined;
  }
}

function parseInputSource(value: unknown): TableTemplateInputSource | undefined {
  if (value === "system") return "system";
  if (value === "teacher") return "teacher";
  if (value === "custom") return "custom";
  return undefined;
}

function parseSystemValue(value: unknown): TableTemplateSystemValue | undefined {
  switch (value) {
    case "academic_calendar.period": return "academic_calendar.period";
    case "academic_calendar.month": return "academic_calendar.month";
    case "academic_calendar.week": return "academic_calendar.week";
    case "academic_calendar.date_range": return "academic_calendar.date_range";
    case "academic_calendar.events": return "academic_calendar.events";
    default: return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
