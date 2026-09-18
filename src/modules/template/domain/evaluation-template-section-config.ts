import {
  createTableTemplateDocument,
  getTableTemplateLeadingHeaderRowCount,
  parseTableTemplateDocument,
  type TableTemplateCellDraft,
  type TableTemplateDocument,
  type TableTemplateInputKind,
  type TableTemplateInputSource,
  type TableTemplateSystemValue,
} from "./table-template";

export const EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES = [
  "title_only",
  "teaching_learning_table",
  "outline_text",
  "achievement_rate_table",
  "semester_achievement_level_table",
  "evaluation_method_table",
  "written_assessment_table",
  "performance_assessment_table",
] as const;

export type EvaluationTemplateSectionFormatType =
  (typeof EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES)[number];

export type TemplateFieldInputKind = TableTemplateInputKind;
export type TemplateFieldSource = TableTemplateInputSource;
export type TemplateSystemValue = TableTemplateSystemValue;
export type TemplateOrientation = "portrait" | "landscape";
export type TableLayoutPolicy = {
  orientation: TemplateOrientation;
  repeatHeader: boolean;
};

type SectionTemplateField = {
  id: string;
  fieldKey: string;
  label: string;
  inputKind: TemplateFieldInputKind;
  source: TemplateFieldSource;
  systemValue?: TemplateSystemValue;
  required?: boolean;
};

type TeachingLearningTableField = SectionTemplateField & {
  placement: "main" | "detail";
  widthWeight?: number;
};

type TableSectionConfig<TType extends Exclude<EvaluationTemplateSectionFormatType, "title_only" | "outline_text">> = {
  type: TType;
  layout: TableLayoutPolicy;
  table: TableTemplateDocument;
};

export type TitleOnlyConfig = {
  type: "title_only";
};

export type TeachingLearningTableConfig = TableSectionConfig<"teaching_learning_table"> & {
  calendarRows: {
    enabled: boolean;
    periodUnit: "month" | "month_week";
  };
};

export type OutlineNumberingStyle =
  | "decimal_dot"
  | "korean_dot"
  | "decimal_paren"
  | "korean_paren"
  | "decimal_bracket"
  | "korean_bracket";

export type OutlineTextConfig = {
  type: "outline_text";
  numberingLevels: OutlineNumberingStyle[];
};

export type AchievementRateTableConfig = TableSectionConfig<"achievement_rate_table">;
export type SemesterAchievementLevelTableConfig = TableSectionConfig<"semester_achievement_level_table">;
export type EvaluationMethodTableConfig = TableSectionConfig<"evaluation_method_table">;
export type WrittenAssessmentTableConfig = TableSectionConfig<"written_assessment_table">;
export type PerformanceAssessmentTableConfig = TableSectionConfig<"performance_assessment_table">;

export type EvaluationTemplateSectionConfig =
  | TitleOnlyConfig
  | TeachingLearningTableConfig
  | OutlineTextConfig
  | AchievementRateTableConfig
  | SemesterAchievementLevelTableConfig
  | EvaluationMethodTableConfig
  | WrittenAssessmentTableConfig
  | PerformanceAssessmentTableConfig;

const INPUT_KINDS = new Set<TemplateFieldInputKind>([
  "text",
  "multiline",
  "number",
  "percentage",
  "achievement_standards",
  "bullet_list",
  "checkbox_list",
]);
const FIELD_SOURCES = new Set<TemplateFieldSource>(["system", "teacher", "custom"]);
const NUMBERING_STYLES = new Set<OutlineNumberingStyle>([
  "decimal_dot",
  "korean_dot",
  "decimal_paren",
  "korean_paren",
  "decimal_bracket",
  "korean_bracket",
]);

export function createDefaultEvaluationTemplateSectionConfig(
  type: EvaluationTemplateSectionFormatType,
): EvaluationTemplateSectionConfig {
  switch (type) {
    case "title_only":
      return { type };
    case "teaching_learning_table": {
      const fields = [
        teachingField(
          "period",
          "period",
          "시기",
          "text",
          "system",
          "main",
          0.8,
          "academic_calendar.period",
        ),
        teachingField("lesson-hours", "lessonHours", "시수/누계", "text", "teacher", "main", 0.9),
        teachingField("unit-name", "unitName", "단원명", "text", "teacher", "main", 1.2),
        teachingField(
          "achievement-standards",
          "achievementStandards",
          "교육과정 성취기준",
          "achievement_standards",
          "teacher",
          "main",
          2.3,
        ),
        teachingField("evaluation-elements", "evaluationElements", "평가 요소", "bullet_list", "teacher", "main", 1.8),
        teachingField("teaching-methods", "teachingMethods", "수업", "multiline", "teacher", "detail", 4.2),
        teachingField("evaluation-methods", "evaluationMethods", "평가", "multiline", "teacher", "detail", 4.2),
      ];
      return {
        type,
        layout: defaultTableLayout(),
        calendarRows: { enabled: true, periodUnit: "month_week" },
        table: buildTeachingLearningTable(
          fields,
          "수업-평가 방법, 수업·평가 연계의 주안점",
        ),
      };
    }
    case "outline_text":
      return { type, numberingLevels: ["decimal_dot", "korean_dot", "decimal_paren"] };
    case "achievement_rate_table": {
      const rows = [
        { rate: "90% 이상", achievement: "A" },
        { rate: "80% 이상 ~ 90% 미만", achievement: "B" },
        { rate: "70% 이상 ~ 80% 미만", achievement: "C" },
        { rate: "60% 이상 ~ 70% 미만", achievement: "D" },
        { rate: "60% 미만", achievement: "E" },
      ];
      return {
        type,
        layout: defaultTableLayout(),
        table: buildAchievementRateTable("기준 성취율", "성취도", rows),
      };
    }
    case "semester_achievement_level_table":
      return {
        type,
        layout: defaultTableLayout(),
        table: buildSemesterAchievementLevelTable(
          "성취수준",
          "학기단위 성취수준 진술",
          ["A", "B", "C", "D", "E"],
        ),
      };
    case "evaluation_method_table": {
      const rowLabels = ["평가종류(반영비율)", "평가영역", "영역별 반영비율", "평가시기", "성취기준"];
      const fields = [
        field("assessment-area", "assessmentArea", "평가영역", "text"),
        field("weight-percent", "weightPercent", "반영비율", "percentage"),
        field("assessment-period", "assessmentPeriod", "평가시기", "text"),
        field("achievement-standards", "achievementStandards", "성취기준", "achievement_standards"),
      ];
      return {
        type,
        layout: defaultTableLayout(),
        table: buildEvaluationMethodTable(rowLabels, fields),
      };
    }
    case "written_assessment_table": {
      const fields = [
        field("assessment-area", "assessmentArea", "평가 영역", "text"),
        field("assessment-method", "assessmentMethod", "평가 방법", "text"),
        field("weight-percent", "weightPercent", "반영 비율", "percentage"),
        field("max-score", "maxScore", "만점", "number"),
        field("assessment-content", "assessmentContent", "평가 내용 (단원)", "multiline"),
      ];
      return {
        type,
        layout: defaultTableLayout(),
        table: buildWrittenAssessmentTable(fields),
      };
    }
    case "performance_assessment_table": {
      const headerFields = [
        field("achievement-standards", "achievementStandards", "성취기준", "achievement_standards"),
        field("competencies", "competencies", "교과역량", "checkbox_list"),
        field("ai-notice", "aiNotice", "수행평가 시 AI 활용 학생 유의 사항", "multiline"),
      ];
      const rubricColumnLabels = ["단계", "평가요소 (평가주체/평가대상)", "배점", "평가 기준"];
      return {
        type,
        layout: defaultTableLayout(),
        table: buildPerformanceAssessmentTable(headerFields, rubricColumnLabels),
      };
    }
  }
}

export function parseEvaluationTemplateSectionConfig(value: unknown): EvaluationTemplateSectionConfig | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;

  switch (value.type) {
    case "title_only":
      return { type: value.type };
    case "teaching_learning_table": {
      const layout = value.layout !== undefined
        ? parseTableLayout(value.layout)
        : parseLegacyTeachingLayout(value);
      if (!layout) return undefined;
      const storedTable = parseOptionalStoredTable(value.table);
      const parsedCalendarRows = parseTeachingLearningCalendarRows(value.calendarRows);
      if (value.calendarRows !== undefined && !parsedCalendarRows) return undefined;
      if (value.table !== undefined) {
        if (!storedTable) return undefined;
        const migratedTable = migrateTeachingLearningSystemValues(storedTable);
        return {
          type: value.type,
          layout,
          calendarRows: parsedCalendarRows ?? inferTeachingLearningCalendarRows(migratedTable),
          table: migratedTable,
        };
      }
      const fields = parseTeachingFields(value.fields);
      if (!fields) return undefined;
      const detailHeaderLabel = readOptionalString(value.detailHeaderLabel, 120);
      if (value.detailHeaderLabel !== undefined && detailHeaderLabel === undefined) return undefined;
      return {
        type: value.type,
        layout,
        calendarRows: parsedCalendarRows ?? inferLegacyTeachingCalendarRows(fields),
        table: buildTeachingLearningTable(fields, detailHeaderLabel),
      };
    }
    case "outline_text": {
      if (!Array.isArray(value.numberingLevels) || value.numberingLevels.length === 0 || value.numberingLevels.length > 6) {
        return undefined;
      }
      const numberingLevels = value.numberingLevels.filter(isOutlineNumberingStyle);
      return numberingLevels.length === value.numberingLevels.length ? { type: value.type, numberingLevels } : undefined;
    }
    case "achievement_rate_table": {
      const layout = parseOptionalTableLayout(value.layout);
      if (!layout) return undefined;
      const storedTable = parseOptionalStoredTable(value.table);
      if (value.table !== undefined) {
        return storedTable ? { type: value.type, layout, table: storedTable } : undefined;
      }
      const rateLabel = readString(value.rateLabel, 80);
      const achievementLabel = readString(value.achievementLabel, 80);
      const rows = parseAchievementRateRows(value.rows);
      if (!rateLabel || !achievementLabel || !rows) return undefined;
      return {
        type: value.type,
        layout,
        table: buildAchievementRateTable(rateLabel, achievementLabel, rows),
      };
    }
    case "semester_achievement_level_table": {
      const layout = parseOptionalTableLayout(value.layout);
      if (!layout) return undefined;
      const storedTable = parseOptionalStoredTable(value.table);
      if (value.table !== undefined) {
        return storedTable ? { type: value.type, layout, table: storedTable } : undefined;
      }
      const levelLabel = readString(value.levelLabel, 80);
      const statementLabel = readString(value.statementLabel, 120);
      const levels = parseStringArray(value.levels, 2, 10, 20);
      if (!levelLabel || !statementLabel || !levels) return undefined;
      return {
        type: value.type,
        layout,
        table: buildSemesterAchievementLevelTable(levelLabel, statementLabel, levels),
      };
    }
    case "evaluation_method_table": {
      const layout = parseOptionalTableLayout(value.layout);
      if (!layout) return undefined;
      const storedTable = parseOptionalStoredTable(value.table);
      if (value.table !== undefined) {
        return storedTable ? { type: value.type, layout, table: storedTable } : undefined;
      }
      const rowLabels = parseStringArray(value.rowLabels, 1, 20, 100);
      const fields = parseFields(value.fields);
      if (!rowLabels || !fields) return undefined;
      return {
        type: value.type,
        layout,
        table: buildEvaluationMethodTable(rowLabels, fields),
      };
    }
    case "written_assessment_table": {
      const layout = parseOptionalTableLayout(value.layout);
      if (!layout) return undefined;
      const storedTable = parseOptionalStoredTable(value.table);
      if (value.table !== undefined) {
        return storedTable ? { type: value.type, layout, table: storedTable } : undefined;
      }
      const fields = parseFields(value.fields);
      if (!fields) return undefined;
      return {
        type: value.type,
        layout,
        table: buildWrittenAssessmentTable(fields),
      };
    }
    case "performance_assessment_table": {
      const layout = parseOptionalTableLayout(value.layout);
      if (!layout) return undefined;
      const storedTable = parseOptionalStoredTable(value.table);
      if (value.table !== undefined) {
        return storedTable ? { type: value.type, layout, table: storedTable } : undefined;
      }
      const headerFields = parseFields(value.headerFields);
      const rubricColumnLabels = parseStringArray(value.rubricColumnLabels, 2, 12, 120);
      if (!headerFields || !rubricColumnLabels) return undefined;
      return {
        type: value.type,
        layout,
        table: buildPerformanceAssessmentTable(headerFields, rubricColumnLabels),
      };
    }
    default:
      return undefined;
  }
}

export function getEvaluationTemplateSectionConfigIssues(config: EvaluationTemplateSectionConfig): string[] {
  if (config.type === "title_only" || config.type === "outline_text") return [];
  const fieldKeys = new Set<string>();
  let systemCellCount = 0;
  for (const row of config.table.content[0].content) {
    for (const cell of row.content) {
      const fieldKey = cell.attrs.fieldKey;
      if (!fieldKey) continue;
      if (fieldKeys.has(fieldKey)) return ["표에 같은 입력 항목이 두 번 연결되어 있습니다."];
      fieldKeys.add(fieldKey);
      if (cell.attrs.inputSource === "system") {
        systemCellCount += 1;
        if (config.type !== "teaching_learning_table") {
          return ["학사일정 자동값은 교수학습-평가 표에서만 사용할 수 있습니다."];
        }
        if (!cell.attrs.systemValue) {
          return ["학사일정 자동 데이터 칸에서 표시할 값을 선택해 주세요."];
        }
      }
    }
  }
  if (config.type === "teaching_learning_table") {
    if (systemCellCount > 0 && !config.calendarRows.enabled) {
      return ["학사일정 자동 데이터 칸을 사용하려면 학사일정 기준 자동 행 생성을 켜 주세요."];
    }
    if (
      config.calendarRows.periodUnit === "month"
      && config.table.content[0].content.some((row) => row.content.some(
        (cell) => cell.attrs.systemValue === "academic_calendar.week",
      ))
    ) {
      return ["월 단위 자동 행에서는 '학사일정: 주' 값을 사용할 수 없습니다."];
    }
  }
  if (config.type === "teaching_learning_table" && config.calendarRows.enabled) {
    const rows = config.table.content[0].content;
    const headerRowCount = getTableTemplateLeadingHeaderRowCount(config.table);
    if (headerRowCount >= rows.length) {
      return ["학사일정 자동 행을 사용하려면 머리글 아래에 반복할 본문 행이 하나 이상 필요합니다."];
    }
    for (let rowIndex = 0; rowIndex < headerRowCount; rowIndex += 1) {
      for (const cell of rows[rowIndex].content) {
        if (rowIndex + cell.attrs.rowspan > headerRowCount) {
          return ["학사일정 자동 행을 사용할 때 머리글 셀은 본문 행까지 세로 병합할 수 없습니다."];
        }
      }
    }
  }
  return [];
}

function teachingField(
  id: string,
  fieldKey: string,
  label: string,
  inputKind: TemplateFieldInputKind,
  source: TemplateFieldSource,
  placement: "main" | "detail",
  widthWeight: number,
  systemValue?: TemplateSystemValue,
): TeachingLearningTableField {
  return {
    id,
    fieldKey,
    label,
    inputKind,
    source,
    placement,
    widthWeight,
    ...(systemValue ? { systemValue } : {}),
  };
}

function field(id: string, fieldKey: string, label: string, inputKind: TemplateFieldInputKind): SectionTemplateField {
  return { id, fieldKey, label, inputKind, source: "teacher" };
}

function defaultTableLayout(): TableLayoutPolicy {
  return { orientation: "portrait", repeatHeader: true };
}

function parseOptionalTableLayout(value: unknown): TableLayoutPolicy | undefined {
  return value === undefined ? defaultTableLayout() : parseTableLayout(value);
}

function parseTableLayout(value: unknown): TableLayoutPolicy | undefined {
  if (!isRecord(value)) return undefined;
  const orientation = value.orientation;
  const repeatHeader = value.repeatHeader;
  if ((orientation !== "portrait" && orientation !== "landscape") || typeof repeatHeader !== "boolean") {
    return undefined;
  }
  return { orientation, repeatHeader };
}

function parseLegacyTeachingLayout(value: Record<string, unknown>): TableLayoutPolicy | undefined {
  const orientation = value.orientation;
  const repeatHeader = value.repeatHeader;
  if ((orientation !== "portrait" && orientation !== "landscape") || typeof repeatHeader !== "boolean") {
    return undefined;
  }
  return { orientation, repeatHeader };
}

function buildTeachingLearningTable(
  fields: readonly TeachingLearningTableField[],
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

function buildAchievementRateTable(
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

function buildSemesterAchievementLevelTable(
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

function buildEvaluationMethodTable(
  rowLabels: readonly string[],
  fields: readonly SectionTemplateField[],
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

function buildWrittenAssessmentTable(
  fields: readonly SectionTemplateField[],
): TableTemplateDocument {
  return createTableTemplateDocument([
    fields.map((item) => ({ kind: "text", text: item.label, header: true })),
    fields.map((item) => inputDraft(item)),
  ]);
}

function buildPerformanceAssessmentTable(
  headerFields: readonly SectionTemplateField[],
  rubricColumnLabels: readonly string[],
): TableTemplateDocument {
  const columnCount = Math.max(2, rubricColumnLabels.length);
  const rows: TableTemplateCellDraft[][] = headerFields.map((item) => [
    { kind: "text", text: item.label, header: true },
    inputDraft(item, { colspan: columnCount - 1 }),
  ]);
  rows.push(rubricColumnLabels.map((label) => ({ kind: "text", text: label, header: true })));
  rows.push(rubricColumnLabels.map(() => ({ kind: "text", text: "" })));
  return createTableTemplateDocument(rows);
}

function inputDraft(
  item: SectionTemplateField,
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

function normalizeLabel(value: string): string {
  return value.replace(/[\s()]/g, "").toLowerCase();
}

function teachingFieldWidth(widthWeight: number | undefined): number {
  const weight = widthWeight ?? 1;
  return Math.max(56, Math.min(480, Math.round(weight * 80)));
}

function matchFieldsToRows(
  rowLabels: readonly string[],
  fields: readonly SectionTemplateField[],
): Array<SectionTemplateField | undefined> {
  const result: Array<SectionTemplateField | undefined> = Array.from(
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

function parseTeachingFields(value: unknown): TeachingLearningTableField[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) return undefined;
  const result: TeachingLearningTableField[] = [];
  for (const item of value) {
    const parsed = parseField(item);
    if (!parsed || !isRecord(item) || (item.placement !== "main" && item.placement !== "detail")) return undefined;
    const widthWeight = item.widthWeight;
    if (widthWeight !== undefined && (typeof widthWeight !== "number" || !Number.isFinite(widthWeight) || widthWeight <= 0 || widthWeight > 20)) {
      return undefined;
    }
    const systemValue = parsed.source === "system"
      ? parsed.systemValue ?? inferTeachingCalendarSystemValue(parsed.fieldKey, parsed.label)
      : undefined;
    result.push({
      ...parsed,
      ...(systemValue ? { systemValue } : {}),
      placement: item.placement,
      ...(widthWeight === undefined ? {} : { widthWeight }),
    });
  }
  return result;
}

function parseFields(value: unknown): SectionTemplateField[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) return undefined;
  const result: SectionTemplateField[] = [];
  for (const item of value) {
    const parsed = parseField(item);
    if (!parsed) return undefined;
    result.push(parsed);
  }
  return result;
}

function parseField(value: unknown): SectionTemplateField | undefined {
  if (!isRecord(value)) return undefined;
  const id = readString(value.id, 80);
  const fieldKey = readString(value.fieldKey, 80);
  const label = readString(value.label, 120);
  const inputKind = value.inputKind;
  const source = value.source;
  const systemValue = parseTemplateSystemValue(value.systemValue);
  if (!id || !fieldKey || !label || !isTemplateFieldInputKind(inputKind) || !isTemplateFieldSource(source)) return undefined;
  if (value.systemValue !== undefined && systemValue === undefined) return undefined;
  if (systemValue && source !== "system") return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(id) || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(fieldKey)) return undefined;
  if (value.required !== undefined && typeof value.required !== "boolean") return undefined;
  return {
    id,
    fieldKey,
    label,
    inputKind,
    source,
    ...(systemValue ? { systemValue } : {}),
    ...(value.required === undefined ? {} : { required: value.required }),
  };
}

function parseTeachingLearningCalendarRows(value: unknown): TeachingLearningTableConfig["calendarRows"] | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.enabled !== "boolean") return undefined;
  if (value.periodUnit !== "month" && value.periodUnit !== "month_week") return undefined;
  return { enabled: value.enabled, periodUnit: value.periodUnit };
}

function inferTeachingLearningCalendarRows(table: TableTemplateDocument): TeachingLearningTableConfig["calendarRows"] {
  let hasSystemField = false;
  let needsWeeklyRows = false;
  for (const row of table.content[0].content) {
    for (const cell of row.content) {
      if (cell.attrs.inputSource !== "system" || !cell.attrs.systemValue) continue;
      hasSystemField = true;
      if (
        cell.attrs.systemValue === "academic_calendar.week"
        || cell.attrs.systemValue === "academic_calendar.date_range"
        || cell.attrs.systemValue === "academic_calendar.events"
        || cell.attrs.systemValue === "academic_calendar.period"
      ) {
        needsWeeklyRows = true;
      }
    }
  }
  return {
    enabled: hasSystemField,
    periodUnit: needsWeeklyRows ? "month_week" : "month",
  };
}

function inferLegacyTeachingCalendarRows(
  fields: readonly TeachingLearningTableField[],
): TeachingLearningTableConfig["calendarRows"] {
  const systemFields = fields.filter((fieldItem) => fieldItem.source === "system" && fieldItem.systemValue);
  return {
    enabled: systemFields.length > 0,
    periodUnit: systemFields.some((fieldItem) => fieldItem.systemValue !== "academic_calendar.month")
      ? "month_week"
      : "month",
  };
}

function migrateTeachingLearningSystemValues(table: TableTemplateDocument): TableTemplateDocument {
  return {
    ...table,
    content: [{
      ...table.content[0],
      content: table.content[0].content.map((row) => ({
        ...row,
        content: row.content.map((cell) => {
          if (cell.attrs.inputSource !== "system" || cell.attrs.systemValue) return cell;
          const inferred = inferTeachingCalendarSystemValue(
            cell.attrs.fieldKey ?? "",
            cell.attrs.fieldLabel ?? "",
          );
          return inferred
            ? { ...cell, attrs: { ...cell.attrs, systemValue: inferred } }
            : cell;
        }),
      })),
    }],
  };
}

function inferTeachingCalendarSystemValue(
  fieldKey: string,
  label: string,
): TemplateSystemValue | undefined {
  const normalizedKey = fieldKey.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const normalizedLabel = label.replace(/[\s()·/_-]/g, "").toLowerCase();

  if (normalizedLabel === "월" || normalizedKey === "month" || normalizedKey.endsWith("month")) {
    return "academic_calendar.month";
  }
  if (
    normalizedLabel === "주"
    || normalizedLabel.startsWith("주차")
    || normalizedKey === "week"
    || normalizedKey.endsWith("week")
  ) {
    return "academic_calendar.week";
  }
  if (
    normalizedLabel.includes("기간")
    || normalizedLabel.includes("날짜")
    || normalizedKey.includes("daterange")
    || normalizedKey.includes("perioddate")
  ) {
    return "academic_calendar.date_range";
  }
  if (
    normalizedLabel.includes("학사일정")
    || normalizedLabel.includes("학교행사")
    || normalizedKey.includes("calendarevent")
    || normalizedKey.includes("schoolevent")
    || normalizedKey === "crosscurricularevents"
  ) {
    return "academic_calendar.events";
  }
  if (
    normalizedLabel === "시기"
    || normalizedKey === "period"
    || normalizedKey.endsWith("period")
  ) {
    return "academic_calendar.period";
  }
  return undefined;
}

function parseAchievementRateRows(value: unknown): Array<{ rate: string; achievement: string }> | undefined {
  if (!Array.isArray(value) || value.length < 2 || value.length > 10) return undefined;
  const rows: Array<{ rate: string; achievement: string }> = [];
  for (const item of value) {
    if (!isRecord(item)) return undefined;
    const rate = readString(item.rate, 100);
    const achievement = readString(item.achievement, 20);
    if (!rate || !achievement) return undefined;
    rows.push({ rate, achievement });
  }
  return rows;
}

function parseOptionalStoredTable(value: unknown): TableTemplateDocument | undefined {
  return value === undefined ? undefined : parseTableTemplateDocument(value);
}

function parseStringArray(value: unknown, min: number, max: number, maxLength: number): string[] | undefined {
  if (!Array.isArray(value) || value.length < min || value.length > max) return undefined;
  const result = value.map((item) => readString(item, maxLength));
  return result.every((item): item is string => item !== undefined) ? result : undefined;
}

function readString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

function readOptionalString(value: unknown, maxLength: number): string | undefined {
  return value === undefined ? undefined : readString(value, maxLength);
}

function isTemplateFieldInputKind(value: unknown): value is TemplateFieldInputKind {
  return typeof value === "string" && INPUT_KINDS.has(value as TemplateFieldInputKind);
}

function isTemplateFieldSource(value: unknown): value is TemplateFieldSource {
  return typeof value === "string" && FIELD_SOURCES.has(value as TemplateFieldSource);
}

function parseTemplateSystemValue(value: unknown): TemplateSystemValue | undefined {
  switch (value) {
    case "academic_calendar.period": return value;
    case "academic_calendar.month": return value;
    case "academic_calendar.week": return value;
    case "academic_calendar.date_range": return value;
    case "academic_calendar.events": return value;
    default: return undefined;
  }
}

function isOutlineNumberingStyle(value: unknown): value is OutlineNumberingStyle {
  return typeof value === "string" && NUMBERING_STYLES.has(value as OutlineNumberingStyle);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
