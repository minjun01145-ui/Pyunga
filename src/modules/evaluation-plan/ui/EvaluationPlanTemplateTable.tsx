"use client";

import type {
  EvaluationPlanDraftFieldValue,
} from "@/modules/evaluation-plan";
import {
  resolveAcademicCalendarSystemValue,
  type TeachingLearningCalendarRow,
} from "@/modules/evaluation-plan";
import {
  getTableTemplateColumnWidths,
  getTableTemplateLeadingHeaderRowCount,
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
  calendarRows?: TeachingLearningCalendarRow[];
  rowValues?: Record<string, { fields: Record<string, EvaluationPlanDraftFieldValue> }>;
  onRowChange?: (rowKey: string, fieldKey: string, value: EvaluationPlanDraftFieldValue) => void;
};

export function EvaluationPlanTemplateTable({
  table,
  values,
  onChange,
  calendarRows,
  rowValues,
  onRowChange,
}: Props) {
  const columnWidths = getTableTemplateColumnWidths(table);
  const headerRowCount = getTableTemplateLeadingHeaderRowCount(table);
  const templateRows = table.content[0].content;
  const headerRows = templateRows.slice(0, headerRowCount);
  const bodyRows = templateRows.slice(headerRowCount);
  const usesCalendarRows = calendarRows !== undefined && onRowChange !== undefined;

  return (
    <div className={styles.tableScroll}>
      <table className={styles.inputTable}>
        <colgroup>
          {columnWidths.map((width, index) => (
            <col key={index} style={width ? { width: `${width}px` } : undefined} />
          ))}
        </colgroup>
        {headerRows.length > 0 ? (
          <thead>
            {headerRows.map((row, rowIndex) => (
              <tr key={`header-${rowIndex}`}>
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
          </thead>
        ) : null}
        <tbody>
          {usesCalendarRows ? calendarRows.flatMap((calendarRow) =>
            bodyRows.map((row, rowIndex) => (
              <tr key={`${calendarRow.key}:${rowIndex}`}>
                {row.content.map((cell, cellIndex) => (
                  <TemplateCell
                    key={`${calendarRow.key}:${rowIndex}-${cellIndex}`}
                    cell={cell}
                    calendarRow={calendarRow}
                    value={cell.attrs.fieldKey
                      ? rowValues?.[calendarRow.key]?.fields[cell.attrs.fieldKey]
                      : undefined}
                    onChange={(fieldKey, value) => onRowChange(calendarRow.key, fieldKey, value)}
                  />
                ))}
              </tr>
            ))) : bodyRows.map((row, rowIndex) => (
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
  calendarRow,
  value,
  onChange,
}: {
  cell: TableTemplateCellNode;
  calendarRow?: TeachingLearningCalendarRow;
  value: EvaluationPlanDraftFieldValue | undefined;
  onChange: (fieldKey: string, value: EvaluationPlanDraftFieldValue) => void;
}) {
  const CellTag = cell.type === "tableHeader" ? "th" : "td";
  const fieldKey = cell.attrs.fieldKey;
  const isSystemCell = cell.attrs.inputSource === "system";

  return (
    <CellTag
      colSpan={cell.attrs.colspan}
      rowSpan={cell.attrs.rowspan}
    >
      {fieldKey && isSystemCell ? (
        <span className={styles.systemCellText}>
          {calendarRow
            ? resolveAcademicCalendarSystemValue(cell.attrs.systemValue, calendarRow)
            : "학사일정 자동 입력"}
        </span>
      ) : fieldKey ? (
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
