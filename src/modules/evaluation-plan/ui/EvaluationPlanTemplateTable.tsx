"use client";

import type {
  EvaluationPlanDraftFieldValue,
} from "@/modules/evaluation-plan";
import {
  getTableTemplateColumnWidths,
  tableTemplateCellText,
  type TableTemplateCellNode,
  type TableTemplateDocument,
  type TableTemplateInputKind,
} from "@/modules/template";

import styles from "./EvaluationPlanWorkspace.module.css";

type Props = {
  table: TableTemplateDocument;
  values: Record<string, EvaluationPlanDraftFieldValue>;
  onChange: (fieldKey: string, value: EvaluationPlanDraftFieldValue) => void;
};

export function EvaluationPlanTemplateTable({ table, values, onChange }: Props) {
  const columnWidths = getTableTemplateColumnWidths(table);
  return (
    <div className={styles.tableScroll}>
      <table className={styles.inputTable}>
        <colgroup>
          {columnWidths.map((width, index) => (
            <col key={index} style={width ? { width: `${width}px` } : undefined} />
          ))}
        </colgroup>
        <tbody>
          {table.content[0].content.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.content.map((cell, cellIndex) => (
                <TemplateCell
                  key={`${rowIndex}-${cellIndex}`}
                  cell={cell}
                  value={cell.attrs.fieldKey ? values[cell.attrs.fieldKey] : undefined}
                  onChange={onChange}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TemplateCell({
  cell,
  value,
  onChange,
}: {
  cell: TableTemplateCellNode;
  value: EvaluationPlanDraftFieldValue | undefined;
  onChange: (fieldKey: string, value: EvaluationPlanDraftFieldValue) => void;
}) {
  const CellTag = cell.type === "tableHeader" ? "th" : "td";
  const fieldKey = cell.attrs.fieldKey;

  return (
    <CellTag
      colSpan={cell.attrs.colspan}
      rowSpan={cell.attrs.rowspan}
    >
      {fieldKey ? (
        <TemplateFieldInput
          fieldKey={fieldKey}
          label={cell.attrs.fieldLabel || "입력"}
          kind={cell.attrs.inputKind ?? "text"}
          required={cell.attrs.required === true}
          value={value}
          onChange={onChange}
        />
      ) : (
        <span className={styles.fixedCellText}>{tableTemplateCellText(cell)}</span>
      )}
    </CellTag>
  );
}

function TemplateFieldInput({
  fieldKey,
  label,
  kind,
  required,
  value,
  onChange,
}: {
  fieldKey: string;
  label: string;
  kind: TableTemplateInputKind;
  required: boolean;
  value: EvaluationPlanDraftFieldValue | undefined;
  onChange: (fieldKey: string, value: EvaluationPlanDraftFieldValue) => void;
}) {
  if (kind === "bullet_list" || kind === "checkbox_list") {
    const text = Array.isArray(value) ? value.join("\n") : typeof value === "string" ? value : "";
    return (
      <textarea
        aria-label={label}
        className={styles.tableTextarea}
        rows={4}
        required={required}
        placeholder="한 줄에 하나씩 입력"
        value={text}
        onChange={(event) => onChange(fieldKey, linesFromTextarea(event.target.value))}
      />
    );
  }

  const text = typeof value === "string" ? value : Array.isArray(value) ? value.join("\n") : "";
  if (kind === "multiline" || kind === "achievement_standards") {
    return (
      <textarea
        aria-label={label}
        className={styles.tableTextarea}
        rows={4}
        maxLength={10_000}
        required={required}
        placeholder={label}
        value={text}
        onChange={(event) => onChange(fieldKey, event.target.value)}
      />
    );
  }

  return (
    <input
      aria-label={label}
      className={styles.tableInput}
      type={kind === "number" || kind === "percentage" ? "number" : "text"}
      min={kind === "percentage" ? 0 : undefined}
      max={kind === "percentage" ? 100 : undefined}
      step={kind === "number" || kind === "percentage" ? "any" : undefined}
      maxLength={kind === "text" ? 10_000 : undefined}
      required={required}
      placeholder={label}
      value={text}
      onChange={(event) => onChange(fieldKey, event.target.value)}
    />
  );
}

function linesFromTextarea(value: string): string[] {
  if (value.length === 0) return [];
  return value.split("\n");
}
