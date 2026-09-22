import {
  createTableTemplateDocument,
  type TableTemplateCellDraft,
  type TableTemplateDocument,
  type TableTemplateInputKind,
  type TableTemplateInputSource,
  type TableTemplateSystemValue,
} from "./table-template";

export type SectionTemplateFieldDraft = {
  id: string;
  fieldKey: string;
  label: string;
  inputKind: TableTemplateInputKind;
  source: TableTemplateInputSource;
  systemValue?: TableTemplateSystemValue;
  required?: boolean;
};

export type TeachingLearningTableFieldDraft = SectionTemplateFieldDraft & {
  placement: "main" | "detail";
  widthWeight?: number;
};

export function buildTeachingLearningTable(
  fields: readonly TeachingLearningTableFieldDraft[],
  detailHeaderLabel?: string,
): TableTemplateDocument {
  const mainFields = fields.filter((item) => item.placement === "main");
  const detailFields = fields.filter((item) => item.placement === "detail");
  const bodyRowCount = Math.max(1, detailFields.length);
  const mainColumnWidths = mainFields.map((item) => teachingFieldWidth(item.widthWeight));
  const detailRegionWidth = Math.max(
    180,
    ...detailFields.map((item) => teachingFieldWidth(item.widthWeight)),
  );
  const detailLabelWidth = 64;
  const detailValueWidth = Math.max(120, detailRegionWidth - detailLabelWidth);
  const headerRow: TableTemplateCellDraft[] = mainFields.map((item) => ({
    kind: "text",
    text: item.label,
    header: true,
    colwidth: [teachingFieldWidth(item.widthWeight)],
  }));

  if (detailFields.length > 0) {
    headerRow.push({
      kind: "text",
      text: detailHeaderLabel ?? "수업·평가 방법",
      header: true,
      colspan: 2,
      colwidth: [detailLabelWidth, detailValueWidth],
    });
  }

  const bodyRows: TableTemplateCellDraft[][] = [];
  for (let rowIndex = 0; rowIndex < bodyRowCount; rowIndex += 1) {
    const row: TableTemplateCellDraft[] = [];
    if (rowIndex === 0) {
      for (let fieldIndex = 0; fieldIndex < mainFields.length; fieldIndex += 1) {
        row.push(inputDraft(mainFields[fieldIndex], {
          rowspan: bodyRowCount,
          colwidth: [mainColumnWidths[fieldIndex]],
        }));
      }
    }
    const detailField = detailFields[rowIndex];
    if (detailField) {
      row.push({
        kind: "text",
        text: detailField.label,
        header: true,
        colwidth: [detailLabelWidth],
      });
      row.push(inputDraft(detailField, { colwidth: [detailValueWidth] }));
    }
    bodyRows.push(row);
  }

  return createTableTemplateDocument([headerRow, ...bodyRows]);
}

export function buildAchievementRateTable(
  rateLabel: string,
  achievementLabel: string,
  rows: readonly { rate: string; achievement: string }[],
): TableTemplateDocument {
  return createTableTemplateDocument([
    [
      { kind: "text", text: rateLabel, header: true },
      { kind: "text", text: achievementLabel, header: true },
    ],
    ...rows.map((row) => [
      { kind: "text", text: row.rate },
      { kind: "text", text: row.achievement },
    ] satisfies TableTemplateCellDraft[]),
  ]);
}

export function buildSemesterAchievementLevelTable(
  levelLabel: string,
  statementLabel: string,
  levels: readonly string[],
): TableTemplateDocument {
  return createTableTemplateDocument([
    [
      { kind: "text", text: levelLabel, header: true },
      { kind: "text", text: statementLabel, header: true },
    ],
    ...levels.map((level, index) => [
      { kind: "text", text: level },
      {
        kind: "input",
        fieldKey: `semesterAchievement.level${index + 1}`,
        fieldLabel: `${level} 성취수준 진술`,
        inputKind: "multiline",
        inputSource: "teacher",
      },
    ] satisfies TableTemplateCellDraft[]),
  ]);
}

export function buildEvaluationMethodTable(
  rowLabels: readonly string[],
  fields: readonly SectionTemplateFieldDraft[],
): TableTemplateDocument {
  const fieldMatches = matchFieldsToRows(rowLabels, fields);
  return createTableTemplateDocument(rowLabels.map((label, index) => {
    const matched = fieldMatches[index];
    return [
      { kind: "text", text: label, header: true },
      matched
        ? inputDraft(matched)
        : {
            kind: "input",
            fieldKey: `evaluationMethod.row${index + 1}`,
            fieldLabel: label,
            inputKind: "text",
            inputSource: "custom",
          },
    ];
  }));
}

export function buildWrittenAssessmentTable(
  fields: readonly SectionTemplateFieldDraft[],
): TableTemplateDocument {
  return createTableTemplateDocument([
    fields.map((item) => ({ kind: "text", text: item.label, header: true })),
    fields.map((item) => inputDraft(item)),
  ]);
}

export function buildPerformanceAssessmentTable(
  headerFields: readonly SectionTemplateFieldDraft[],
  rubricColumnLabels: readonly string[],
  editableRubric = false,
): TableTemplateDocument {
  const columnCount = Math.max(2, rubricColumnLabels.length);
  const rows: TableTemplateCellDraft[][] = headerFields.map((item) => [
    { kind: "text", text: item.label, header: true },
    inputDraft(item, { colspan: columnCount - 1 }),
  ]);
  rows.push(rubricColumnLabels.map((label) => ({ kind: "text", text: label, header: true })));
  rows.push(rubricColumnLabels.map((label, index) => editableRubric ? ({
    kind: "input",
    fieldKey: `rubric.column${index + 1}`,
    fieldLabel: label,
    inputKind: "multiline",
    inputSource: "teacher",
  }) : ({ kind: "text", text: "" })));
  return createTableTemplateDocument(rows);
}

function inputDraft(
  item: SectionTemplateFieldDraft,
  span?: Pick<TableTemplateCellDraft, "colspan" | "rowspan" | "colwidth">,
): TableTemplateCellDraft {
  return {
    kind: "input",
    fieldKey: item.fieldKey,
    fieldLabel: item.label,
    inputKind: item.inputKind,
    inputSource: item.source,
    ...(item.systemValue ? { systemValue: item.systemValue } : {}),
    ...(item.required === undefined ? {} : { required: item.required }),
    ...(span?.colspan ? { colspan: span.colspan } : {}),
    ...(span?.rowspan ? { rowspan: span.rowspan } : {}),
    ...(span?.colwidth ? { colwidth: span.colwidth } : {}),
  };
}

function teachingFieldWidth(widthWeight: number | undefined): number {
  const weight = widthWeight ?? 1;
  return Math.max(56, Math.min(480, Math.round(weight * 80)));
}

function matchFieldsToRows(
  rowLabels: readonly string[],
  fields: readonly SectionTemplateFieldDraft[],
): Array<SectionTemplateFieldDraft | undefined> {
  const result: Array<SectionTemplateFieldDraft | undefined> = Array.from(
    { length: rowLabels.length },
    () => undefined,
  );
  const usedFieldKeys = new Set<string>();
  const normalizedRows = rowLabels.map(normalizeLabel);

  for (let rowIndex = 0; rowIndex < rowLabels.length; rowIndex += 1) {
    const exactMatch = fields.find(
      (item) =>
        !usedFieldKeys.has(item.fieldKey)
        && normalizeLabel(item.label) === normalizedRows[rowIndex],
    );
    if (exactMatch) {
      result[rowIndex] = exactMatch;
      usedFieldKeys.add(exactMatch.fieldKey);
    }
  }

  for (const fieldItem of fields) {
    if (usedFieldKeys.has(fieldItem.fieldKey)) continue;
    const normalizedField = normalizeLabel(fieldItem.label);
    let bestRowIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let rowIndex = 0; rowIndex < rowLabels.length; rowIndex += 1) {
      if (result[rowIndex]) continue;
      const normalizedRow = normalizedRows[rowIndex];
      if (!normalizedRow.includes(normalizedField) && !normalizedField.includes(normalizedRow)) continue;
      const distance = Math.abs(normalizedRow.length - normalizedField.length);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestRowIndex = rowIndex;
      }
    }

    if (bestRowIndex >= 0) {
      result[bestRowIndex] = fieldItem;
      usedFieldKeys.add(fieldItem.fieldKey);
    }
  }

  return result;
}

function normalizeLabel(value: string): string {
  return value.replace(/[\s()]/g, "").toLowerCase();
}
