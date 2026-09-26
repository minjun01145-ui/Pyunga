import type {
  AcademicCalendarEvent,
} from "@/modules/academic-calendar";
import {
  buildTeachingLearningCalendarRows,
  resolveAcademicCalendarSystemValue,
  type EvaluationPlanDraft,
  type EvaluationPlanDraftFieldValue,
  type TeacherEvaluationContext,
  type TeachingLearningCalendarRow,
} from "@/modules/evaluation-plan";
import {
  resolveEvaluationTemplatePresentation,
  type EvaluationTemplatePresentation,
  getTableTemplateColumnWidths,
  getTableTemplateLeadingHeaderRowCount,
  tableTemplateCellText,
  type EvaluationTemplate,
  type EvaluationTemplateSectionLevel,
  type TableTemplateCellNode,
  type TableTemplateDocument,
  type TableTemplateInputKind,
  type TemplateOrientation,
} from "@/modules/template";

export type RawEvaluationPlanCellView = {
  key: string;
  header: boolean;
  text: string;
  colspan: number;
  rowspan: number;
};

export type RawEvaluationPlanTableView = {
  columnWidths: Array<number | null>;
  headerRows: RawEvaluationPlanCellView[][];
  bodyGroups: RawEvaluationPlanCellView[][][];
  repeatHeader: boolean;
};

export type RawEvaluationPlanSectionView = {
  id: string;
  level: EvaluationTemplateSectionLevel;
  marker: string;
  title: string;
  orientation: TemplateOrientation;
  content:
    | { kind: "unconfigured" }
    | { kind: "none" }
    | { kind: "text"; text: string }
    | { kind: "table"; table: RawEvaluationPlanTableView };
};

export type RawEvaluationPlanDocumentView = {
  presentation: EvaluationTemplatePresentation;
  title: string;
  metadataLine: string;
  firstPageOrientation: TemplateOrientation;
  sections: RawEvaluationPlanSectionView[];
};

export function buildRawEvaluationPlanDocument(
  template: EvaluationTemplate,
  draft: EvaluationPlanDraft,
  options?: {
    teacherContext: TeacherEvaluationContext;
    calendarEvents: readonly AcademicCalendarEvent[];
  },
): RawEvaluationPlanDocumentView {
  const counters = [0, 0, 0, 0, 0, 0, 0, 0];
  const orderedSections = template.sections
    .slice()
    .sort((left, right) => left.order - right.order);
  const sections = orderedSections.map((section, sectionIndex): RawEvaluationPlanSectionView => {
      advanceHeadingCounter(counters, section.level);
      const draftSection = draft.sections[section.id];
      const title = section.teacherEditableTitle && draftSection?.title?.trim()
        ? draftSection.title.trim()
        : section.title;

      if (!section.config) {
        return {
          id: section.id,
          level: section.level,
          marker: headingMarker(section.level, counters[section.level]),
          title,
          orientation: structuralHeadingOrientation(orderedSections, sectionIndex),
          content: { kind: "unconfigured" },
        };
      }

      if (section.config.type === "title_only") {
        return {
          id: section.id,
          level: section.level,
          marker: headingMarker(section.level, counters[section.level]),
          title,
          orientation: structuralHeadingOrientation(orderedSections, sectionIndex),
          content: { kind: "none" },
        };
      }

      if (section.config.type === "outline_text") {
        const commonText = section.config.commonText?.trim();
        const teacherText = draftSection?.body ?? "";
        return {
          id: section.id,
          level: section.level,
          marker: headingMarker(section.level, counters[section.level]),
          title,
          orientation: "portrait",
          content: {
            kind: "text",
            text: commonText && teacherText ? `${commonText}\n\n${teacherText}` : commonText ?? teacherText,
          },
        };
      }

      const calendarRows = section.config.type === "teaching_learning_table"
        && section.config.calendarRows.enabled
        && options
        ? buildTeachingLearningCalendarRows(section.config, options.calendarEvents, options.teacherContext)
        : undefined;

      return {
        id: section.id,
        level: section.level,
        marker: headingMarker(section.level, counters[section.level]),
        title,
        orientation: section.config.layout.orientation,
        content: {
          kind: "table",
          table: buildRawTable(
            section.config.table,
            draftSection?.fields ?? {},
            section.config.layout.repeatHeader,
            calendarRows ? {
              calendarRows,
              rowValues: draftSection?.rows,
            } : undefined,
          ),
        },
      };
    });

  return {
    title: buildDocumentTitle(
      template.documentTitle,
      options?.teacherContext.subjectLabel ?? draft.subjectLabel,
    ),
    presentation: resolveEvaluationTemplatePresentation(template.presentation),
    metadataLine: buildMetadataLine(draft),
    firstPageOrientation: sections[0]?.orientation ?? "portrait",
    sections,
  };
}

function buildDocumentTitle(documentTitle: string | undefined, subjectLabel: string): string {
  const title = documentTitle?.trim() || "평가계획";
  const subject = subjectLabel.trim().replace(/과\s*$/u, "").trim();
  if (!subject) return title;

  const subjectPrefix = `${subject}과`;
  const titleAlreadyHasSubject = title === subjectPrefix || title.startsWith(`${subjectPrefix} `);
  const titleWithoutSubject = titleAlreadyHasSubject
    ? title.slice(subjectPrefix.length).trimStart()
    : title;
  return titleWithoutSubject ? `${subjectPrefix} ${titleWithoutSubject}` : subjectPrefix;
}

function structuralHeadingOrientation(
  sections: readonly EvaluationTemplate["sections"][number][],
  sectionIndex: number,
): TemplateOrientation {
  const section = sections[sectionIndex];
  for (let index = sectionIndex + 1; index < sections.length; index += 1) {
    const descendant = sections[index];
    if (descendant.level <= section.level) break;
    if (!descendant.config) continue;
    if (descendant.config.type === "title_only") continue;
    return descendant.config.type === "outline_text"
      ? "portrait"
      : descendant.config.layout.orientation;
  }
  return "portrait";
}

function buildMetadataLine(draft: EvaluationPlanDraft): string {
  return [
    draft.academicYear ? `${draft.academicYear}학년도` : "",
    draft.semester ? `${draft.semester}학기` : "",
    draft.grade ? `${draft.grade}학년` : "",
    draft.subjectLabel.trim(),
  ].filter(Boolean).join(" · ");
}

function buildRawTable(
  table: TableTemplateDocument,
  values: Record<string, EvaluationPlanDraftFieldValue>,
  repeatHeader: boolean,
  calendar?: {
    calendarRows: readonly TeachingLearningCalendarRow[];
    rowValues?: Record<string, { fields: Record<string, EvaluationPlanDraftFieldValue> }>;
  },
): RawEvaluationPlanTableView {
  const templateRows = table.content[0].content;
  const leadingHeaderRowCount = getTableTemplateLeadingHeaderRowCount(table);
  const safeHeaderRowCount = safeRepeatingHeaderRowCount(table);
  const headerRowCount = safeHeaderRowCount === leadingHeaderRowCount
    ? leadingHeaderRowCount
    : 0;
  const headerRows = templateRows.slice(0, headerRowCount).map((row, rowIndex) =>
    row.content.map((cell, cellIndex) => toRawCell(cell, values, `${rowIndex}-${cellIndex}`)),
  );
  const bodyTemplateRows = templateRows.slice(headerRowCount);
  const bodyGroups = calendar
    ? calendar.calendarRows.map((calendarRow) => bodyTemplateRows.map((row, rowIndex) =>
      row.content.map((cell, cellIndex) => toRawCell(
        cell,
        calendar.rowValues?.[calendarRow.key]?.fields ?? {},
        `${calendarRow.key}:${rowIndex}-${cellIndex}`,
        calendarRow,
      )),
    ))
    : [[...bodyTemplateRows.map((row, rowIndex) =>
      row.content.map((cell, cellIndex) => toRawCell(cell, values, `${headerRowCount + rowIndex}-${cellIndex}`)),
    )]];

  return {
    columnWidths: getTableTemplateColumnWidths(table),
    headerRows,
    bodyGroups,
    repeatHeader: repeatHeader && headerRows.length > 0,
  };
}

function toRawCell(
  cell: TableTemplateCellNode,
  values: Record<string, EvaluationPlanDraftFieldValue>,
  key: string,
  calendarRow?: TeachingLearningCalendarRow,
): RawEvaluationPlanCellView {
  return {
    key,
    header: cell.type === "tableHeader",
    text: resolvedCellText(cell, values, calendarRow),
    colspan: cell.attrs.colspan,
    rowspan: cell.attrs.rowspan,
  };
}

function resolvedCellText(
  cell: TableTemplateCellNode,
  values: Record<string, EvaluationPlanDraftFieldValue>,
  calendarRow?: TeachingLearningCalendarRow,
): string {
  const fieldKey = cell.attrs.fieldKey;
  if (!fieldKey) return tableTemplateCellText(cell);
  if (cell.attrs.inputSource === "system") {
    return calendarRow
      ? resolveAcademicCalendarSystemValue(cell.attrs.systemValue, calendarRow)
      : "";
  }

  return formatFieldValue(values[fieldKey], cell.attrs.inputKind ?? "text");
}

function formatFieldValue(value: EvaluationPlanDraftFieldValue | undefined, kind: TableTemplateInputKind): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;

  if (kind === "bullet_list") {
    return value.filter((item) => item.trim()).map((item) => `• ${item}`).join("\n");
  }
  if (kind === "checkbox_list") {
    return value.filter((item) => item.trim()).map((item) => `□ ${item}`).join("\n");
  }
  return value.join("\n");
}

function safeRepeatingHeaderRowCount(table: TableTemplateDocument): number {
  let count = 0;
  for (const row of table.content[0].content) {
    if (!row.content.every((cell) => cell.type === "tableHeader")) break;
    count += 1;
  }

  for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
    for (const cell of table.content[0].content[rowIndex].content) {
      if (rowIndex + cell.attrs.rowspan > count) {
        return 0;
      }
    }
  }
  return count;
}

function advanceHeadingCounter(counters: number[], level: EvaluationTemplateSectionLevel): void {
  counters[level] += 1;
  for (let deeper = level + 1; deeper <= 7; deeper += 1) {
    counters[deeper] = 0;
  }
}

function headingMarker(level: EvaluationTemplateSectionLevel, count: number): string {
  switch (level) {
    case 1:
      return "";
    case 2:
      return `${count}.`;
    case 3:
      return `${koreanSequence(count)}.`;
    case 4:
      return `${count})`;
    case 5:
      return `${koreanSequence(count)})`;
    case 6:
      return `(${count})`;
    case 7:
      return `(${koreanSequence(count)})`;
  }
}

function koreanSequence(count: number): string {
  const labels = ["가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카", "타", "파", "하"];
  return labels[count - 1] ?? String(count);
}
