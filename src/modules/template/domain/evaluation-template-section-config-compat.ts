import {
  parseCanonicalEvaluationTemplateSectionConfig,
  type EvaluationTemplateSectionConfig,
  type TableLayoutPolicy,
  type TemplateFieldInputKind,
  type TemplateFieldSource,
  type TemplateSystemValue,
  type TeachingLearningTableConfig,
} from "./evaluation-template-section-config-canonical";
import {
  buildAchievementRateTable,
  buildEvaluationMethodTable,
  buildPerformanceAssessmentTable,
  buildSemesterAchievementLevelTable,
  buildTeachingLearningTable,
  buildWrittenAssessmentTable,
  type SectionTemplateFieldDraft,
  type TeachingLearningTableFieldDraft,
} from "./evaluation-template-section-config-table-builder";
import {
  parseTableTemplateDocument,
  type TableTemplateDocument,
} from "./table-template";

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

export function parseCompatibleEvaluationTemplateSectionConfig(
  value: unknown,
): EvaluationTemplateSectionConfig | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;

  if (value.type === "teaching_learning_table") {
    return parseCompatibleTeachingLearningConfig(value);
  }

  switch (value.type) {
    case "title_only":
    case "outline_text":
      return parseCanonicalEvaluationTemplateSectionConfig(value);
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

function parseCompatibleTeachingLearningConfig(
  value: Record<string, unknown>,
): TeachingLearningTableConfig | undefined {
  const layout = value.layout !== undefined
    ? parseTableLayout(value.layout)
    : parseLegacyTeachingLayout(value);
  if (!layout) return undefined;

  const parsedCalendarRows = parseTeachingLearningCalendarRows(value.calendarRows);
  if (value.calendarRows !== undefined && !parsedCalendarRows) return undefined;

  if (value.table !== undefined) {
    const storedTable = parseTableTemplateDocument(value.table);
    if (!storedTable) return undefined;
    const migratedTable = migrateTeachingLearningSystemValues(storedTable);
    return {
      type: "teaching_learning_table",
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
    type: "teaching_learning_table",
    layout,
    calendarRows: parsedCalendarRows ?? inferLegacyTeachingCalendarRows(fields),
    table: buildTeachingLearningTable(fields, detailHeaderLabel),
  };
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
  return parseTableLayout({
    orientation: value.orientation,
    repeatHeader: value.repeatHeader,
  });
}

function defaultTableLayout(): TableLayoutPolicy {
  return { orientation: "portrait", repeatHeader: true };
}

function parseTeachingFields(value: unknown): TeachingLearningTableFieldDraft[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) return undefined;
  const result: TeachingLearningTableFieldDraft[] = [];
  for (const item of value) {
    const parsed = parseField(item);
    if (!parsed || !isRecord(item) || (item.placement !== "main" && item.placement !== "detail")) return undefined;
    const widthWeight = item.widthWeight;
    if (
      widthWeight !== undefined
      && (typeof widthWeight !== "number" || !Number.isFinite(widthWeight) || widthWeight <= 0 || widthWeight > 20)
    ) {
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

function parseOptionalStoredTable(value: unknown): TableTemplateDocument | undefined {
  return value === undefined ? undefined : parseTableTemplateDocument(value);
}

function parseFields(value: unknown): SectionTemplateFieldDraft[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) return undefined;
  const result: SectionTemplateFieldDraft[] = [];
  for (const item of value) {
    const parsed = parseField(item);
    if (!parsed) return undefined;
    result.push(parsed);
  }
  return result;
}

function parseField(value: unknown): SectionTemplateFieldDraft | undefined {
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

function parseTeachingLearningCalendarRows(
  value: unknown,
): TeachingLearningTableConfig["calendarRows"] | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value) || typeof value.enabled !== "boolean") return undefined;
  if (value.periodUnit !== "month" && value.periodUnit !== "month_week") return undefined;
  return { enabled: value.enabled, periodUnit: value.periodUnit };
}

function inferTeachingLearningCalendarRows(
  table: TableTemplateDocument,
): TeachingLearningTableConfig["calendarRows"] {
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
  fields: readonly TeachingLearningTableFieldDraft[],
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
