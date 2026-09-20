"use client";

import { useMemo, useState } from "react";

import {
  formatAcademicCalendarPeriodDateRange,
  formatAcademicCalendarPeriodEvents,
  type AcademicCalendarTeachingPeriod,
} from "@/modules/academic-calendar";
import {
  getTableTemplateCellPlacements,
  getTableTemplateColumnWidths,
  getTableTemplateLeadingHeaderRowCount,
  tableTemplateCellText,
  type TableTemplateCellNode,
  type TableTemplateDocument,
  type TableTemplateSystemValue,
} from "../domain/table-template";
import type { TeachingLearningTableConfig } from "../domain/evaluation-template-section-config";

import styles from "./TeachingLearningCalendarPreview.module.css";

const SYSTEM_VALUE_OPTIONS: Array<{ value: TableTemplateSystemValue; label: string }> = [
  { value: "academic_calendar.period", label: "월/주 표시" },
  { value: "academic_calendar.month", label: "월" },
  { value: "academic_calendar.week", label: "주" },
  { value: "academic_calendar.date_range", label: "기간(날짜)" },
  { value: "academic_calendar.events", label: "주요 학사 일정" },
];

export function TeachingLearningCalendarPreview({
  config,
  periods,
  onChange,
}: {
  config: TeachingLearningTableConfig;
  periods: readonly AcademicCalendarTeachingPeriod[];
  onChange: (config: TeachingLearningTableConfig) => void;
}) {
  const [selectedColumn, setSelectedColumn] = useState<number>();
  const columnWidths = getTableTemplateColumnWidths(config.table);
  const placements = useMemo(() => getTableTemplateCellPlacements(config.table), [config.table]);
  const headerRowCount = getTableTemplateLeadingHeaderRowCount(config.table);
  const rows = config.table.content[0].content;
  const bodyRows = rows.slice(headerRowCount);
  const configurableCell = selectedColumn === undefined
    ? undefined
    : findFullHeightBodyColumnCell(config.table, selectedColumn);
  const activeSystemValue = configurableCell?.cell.attrs.inputSource === "system"
    ? configurableCell.cell.attrs.systemValue
    : undefined;

  const columnTemplate = columnWidths
    .map((width) => width ? `${width}px` : "minmax(72px, 1fr)")
    .join(" ");

  return (
    <section className={styles.previewShell}>
      <div className={styles.previewHeader}>
        <div>
          <h3 className="subsection-title">학사일정 자동 행 생성 결과</h3>
          <p className="small-copy muted">
            실제 저장된 학사일정으로 {periods.length}개 기간을 만들었습니다. 기간마다 아래 표의 본문 블록이 반복됩니다.
          </p>
        </div>
        <span className={styles.columnStatus}>
          {selectedColumn === undefined ? "설정할 열을 선택하세요." : `${selectedColumn + 1}열 선택됨`}
        </span>
      </div>

      <div className={styles.previewViewport}>
        <div className={styles.columnPicker} style={{ gridTemplateColumns: columnTemplate }}>
          {columnWidths.map((_, columnIndex) => (
            <button
              key={columnIndex}
              className={selectedColumn === columnIndex ? styles.selectedColumnButton : ""}
              type="button"
              onClick={() => setSelectedColumn(columnIndex)}
            >
              {columnIndex + 1}열
            </button>
          ))}
        </div>

        <table className={styles.previewTable}>
          {columnWidths.length > 0 ? (
            <colgroup>
              {columnWidths.map((width, index) => (
                <col key={index} style={width ? { width: `${width}px` } : undefined} />
              ))}
            </colgroup>
          ) : null}
          {headerRowCount > 0 ? (
            <thead>
              {rows.slice(0, headerRowCount).map((row, rowIndex) => (
                <tr key={`header-${rowIndex}`}>
                  {row.content.map((cell, cellIndex) => (
                    <PreviewCell
                      key={`${rowIndex}-${cellIndex}`}
                      cell={cell}
                      placement={placements[rowIndex]?.find((item) => item.cellIndex === cellIndex)}
                      selectedColumn={selectedColumn}
                      onSelectColumn={setSelectedColumn}
                    />
                  ))}
                </tr>
              ))}
            </thead>
          ) : null}
          {periods.map((period) => (
            <tbody key={period.key}>
              {bodyRows.map((row, bodyRowIndex) => {
                const rowIndex = headerRowCount + bodyRowIndex;
                return (
                  <tr key={`${period.key}-${bodyRowIndex}`}>
                    {row.content.map((cell, cellIndex) => (
                      <PreviewCell
                        key={`${period.key}-${bodyRowIndex}-${cellIndex}`}
                        cell={cell}
                        period={period}
                        placement={placements[rowIndex]?.find((item) => item.cellIndex === cellIndex)}
                        selectedColumn={selectedColumn}
                        onSelectColumn={setSelectedColumn}
                      />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      {selectedColumn !== undefined ? (
        <div className={styles.columnSettings}>
          {configurableCell ? (
            <>
              <div className={styles.columnSettingsRow}>
                <label className="field">
                  <span>{selectedColumn + 1}열 학사일정 자동값</span>
                  <select
                    value={activeSystemValue ?? ""}
                    onChange={(event) => {
                      const nextValue = parseSystemValue(event.target.value);
                      onChange({
                        ...config,
                        table: updateCalendarColumnBinding(
                          config.table,
                          configurableCell.rowIndex,
                          configurableCell.cellIndex,
                          selectedColumn,
                          nextValue,
                        ),
                      });
                    }}
                  >
                    <option value="">교과 담당자 입력 열</option>
                    {SYSTEM_VALUE_OPTIONS
                      .filter((option) => config.calendarRows.periodUnit !== "month" || option.value !== "academic_calendar.week")
                      .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <p className={styles.columnHelp}>
                  이 설정은 한 기간의 본문 전체를 세로로 관통하는 단일 열에 적용됩니다. 선택한 열은 파란색으로 표시됩니다.
                </p>
              </div>
            </>
          ) : (
            <p className={styles.columnHelp}>
              이 열은 한 기간 안에서 여러 셀로 나뉘어 있어 학사일정 자동 열로 지정할 수 없습니다. 월·주·기간·주요 일정처럼 기간 전체에 공통인 열을 선택해 주세요.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function PreviewCell({
  cell,
  period,
  placement,
  selectedColumn,
  onSelectColumn,
}: {
  cell: TableTemplateCellNode;
  period?: AcademicCalendarTeachingPeriod;
  placement?: { startColumn: number; endColumn: number };
  selectedColumn?: number;
  onSelectColumn: (column: number) => void;
}) {
  const CellTag = cell.type === "tableHeader" ? "th" : "td";
  const selectableColumn = placement && placement.endColumn === placement.startColumn + 1
    ? placement.startColumn
    : undefined;
  const isSelected = selectedColumn !== undefined
    && placement !== undefined
    && placement.startColumn <= selectedColumn
    && selectedColumn < placement.endColumn;
  const text = resolvePreviewCellText(cell, period);

  return (
    <CellTag
      className={[
        selectableColumn !== undefined ? styles.selectableColumnCell : "",
        isSelected ? styles.selectedColumnCell : "",
      ].filter(Boolean).join(" ")}
      colSpan={cell.attrs.colspan}
      rowSpan={cell.attrs.rowspan}
      onClick={selectableColumn === undefined ? undefined : () => onSelectColumn(selectableColumn)}
      onKeyDown={selectableColumn === undefined ? undefined : (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelectColumn(selectableColumn);
      }}
      role={selectableColumn === undefined ? undefined : "button"}
      tabIndex={selectableColumn === undefined ? undefined : 0}
      aria-pressed={selectableColumn === undefined ? undefined : isSelected}
    >
      {cell.attrs.fieldKey && cell.attrs.inputSource !== "system" ? (
        <span className={styles.teacherPlaceholder}>{text}</span>
      ) : text}
    </CellTag>
  );
}

function resolvePreviewCellText(
  cell: TableTemplateCellNode,
  period?: AcademicCalendarTeachingPeriod,
): string {
  if (!cell.attrs.fieldKey) return tableTemplateCellText(cell);
  if (cell.attrs.inputSource !== "system") return `교과 입력: ${cell.attrs.fieldLabel ?? cell.attrs.fieldKey}`;
  if (!period) return cell.attrs.fieldLabel ?? "학사일정 자동 입력";

  switch (cell.attrs.systemValue) {
    case "academic_calendar.month": return String(period.month);
    case "academic_calendar.week": return period.week === undefined ? "" : String(period.week);
    case "academic_calendar.date_range": return formatAcademicCalendarPeriodDateRange(period);
    case "academic_calendar.events": return formatAcademicCalendarPeriodEvents(period);
    case "academic_calendar.period":
    default:
      return period.label;
  }
}

function findFullHeightBodyColumnCell(
  table: TableTemplateDocument,
  selectedColumn: number,
): { rowIndex: number; cellIndex: number; cell: TableTemplateCellNode } | undefined {
  const headerRowCount = getTableTemplateLeadingHeaderRowCount(table);
  const rows = table.content[0].content;
  const bodyRowCount = rows.length - headerRowCount;
  if (bodyRowCount <= 0) return undefined;
  const placements = getTableTemplateCellPlacements(table);
  const firstBodyRow = rows[headerRowCount];
  const placement = placements[headerRowCount]?.find(
    (item) => item.startColumn === selectedColumn && item.endColumn === selectedColumn + 1,
  );
  if (!placement) return undefined;
  const cell = firstBodyRow.content[placement.cellIndex];
  if (cell.type !== "tableCell" || cell.attrs.rowspan < bodyRowCount) return undefined;
  return { rowIndex: headerRowCount, cellIndex: placement.cellIndex, cell };
}

function updateCalendarColumnBinding(
  table: TableTemplateDocument,
  rowIndex: number,
  cellIndex: number,
  selectedColumn: number,
  systemValue?: TableTemplateSystemValue,
): TableTemplateDocument {
  const rows = table.content[0].content.map((row, currentRowIndex) => {
    if (currentRowIndex !== rowIndex) return row;
    return {
      ...row,
      content: row.content.map((cell, currentCellIndex) => {
        if (currentCellIndex !== cellIndex) return cell;
        if (!systemValue) {
          if (!cell.attrs.fieldKey) return cell;
          const attrs = { ...cell.attrs };
          delete attrs.systemValue;
          return {
            ...cell,
            attrs: { ...attrs, inputSource: "teacher" as const },
          };
        }
        return {
          ...cell,
          attrs: {
            ...cell.attrs,
            fieldKey: cell.attrs.fieldKey ?? `calendar.column${selectedColumn + 1}`,
            fieldLabel: systemValueLabel(systemValue),
            inputKind: systemValue === "academic_calendar.events" ? "multiline" as const : "text" as const,
            inputSource: "system" as const,
            systemValue,
            required: false,
          },
          content: [{ type: "paragraph" as const }],
        };
      }),
    };
  });

  return { ...table, content: [{ ...table.content[0], content: rows }] };
}

function systemValueLabel(value: TableTemplateSystemValue): string {
  return SYSTEM_VALUE_OPTIONS.find((option) => option.value === value)?.label ?? "학사일정";
}

function parseSystemValue(value: string): TableTemplateSystemValue | undefined {
  return SYSTEM_VALUE_OPTIONS.find((option) => option.value === value)?.value;
}
