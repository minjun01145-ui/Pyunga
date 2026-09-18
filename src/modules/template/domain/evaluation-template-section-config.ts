export const EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES = [
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

export type TemplateFieldInputKind =
  | "text"
  | "multiline"
  | "number"
  | "percentage"
  | "achievement_standards"
  | "bullet_list"
  | "checkbox_list";

export type TemplateFieldSource = "system" | "teacher" | "custom";
export type TemplateOrientation = "portrait" | "landscape";

export type SectionTemplateField = {
  id: string;
  fieldKey: string;
  label: string;
  inputKind: TemplateFieldInputKind;
  source: TemplateFieldSource;
  required?: boolean;
};

export type TeachingLearningTableField = SectionTemplateField & {
  placement: "main" | "detail";
  widthWeight?: number;
};

export type TeachingLearningTableConfig = {
  type: "teaching_learning_table";
  orientation: TemplateOrientation;
  repeatHeader: boolean;
  detailHeaderLabel?: string;
  fields: TeachingLearningTableField[];
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

export type AchievementRateTableConfig = {
  type: "achievement_rate_table";
  rateLabel: string;
  achievementLabel: string;
  rows: Array<{ rate: string; achievement: string }>;
};

export type SemesterAchievementLevelTableConfig = {
  type: "semester_achievement_level_table";
  levelLabel: string;
  statementLabel: string;
  levels: string[];
};

export type EvaluationMethodTableConfig = {
  type: "evaluation_method_table";
  rowLabels: string[];
  fields: SectionTemplateField[];
};

export type WrittenAssessmentTableConfig = {
  type: "written_assessment_table";
  fields: SectionTemplateField[];
};

export type PerformanceAssessmentTableConfig = {
  type: "performance_assessment_table";
  headerFields: SectionTemplateField[];
  rubricColumnLabels: string[];
};

export type EvaluationTemplateSectionConfig =
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
    case "teaching_learning_table":
      return {
        type,
        orientation: "portrait",
        repeatHeader: true,
        detailHeaderLabel: "수업-평가 방법, 수업·평가 연계의 주안점",
        fields: [
          teachingField("period", "period", "시기", "text", "system", "main", 0.8),
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
        ],
      };
    case "outline_text":
      return { type, numberingLevels: ["decimal_dot", "korean_dot", "decimal_paren"] };
    case "achievement_rate_table":
      return {
        type,
        rateLabel: "기준 성취율",
        achievementLabel: "성취도",
        rows: [
          { rate: "90% 이상", achievement: "A" },
          { rate: "80% 이상 ~ 90% 미만", achievement: "B" },
          { rate: "70% 이상 ~ 80% 미만", achievement: "C" },
          { rate: "60% 이상 ~ 70% 미만", achievement: "D" },
          { rate: "60% 미만", achievement: "E" },
        ],
      };
    case "semester_achievement_level_table":
      return { type, levelLabel: "성취수준", statementLabel: "학기단위 성취수준 진술", levels: ["A", "B", "C", "D", "E"] };
    case "evaluation_method_table":
      return {
        type,
        rowLabels: ["평가종류(반영비율)", "평가영역", "영역별 반영비율", "평가시기", "성취기준"],
        fields: [
          field("assessment-area", "assessmentArea", "평가영역", "text"),
          field("weight-percent", "weightPercent", "반영비율", "percentage"),
          field("assessment-period", "assessmentPeriod", "평가시기", "text"),
          field("achievement-standards", "achievementStandards", "성취기준", "achievement_standards"),
        ],
      };
    case "written_assessment_table":
      return {
        type,
        fields: [
          field("assessment-area", "assessmentArea", "평가 영역", "text"),
          field("assessment-method", "assessmentMethod", "평가 방법", "text"),
          field("weight-percent", "weightPercent", "반영 비율", "percentage"),
          field("max-score", "maxScore", "만점", "number"),
          field("assessment-content", "assessmentContent", "평가 내용 (단원)", "multiline"),
        ],
      };
    case "performance_assessment_table":
      return {
        type,
        headerFields: [
          field("achievement-standards", "achievementStandards", "성취기준", "achievement_standards"),
          field("competencies", "competencies", "교과역량", "checkbox_list"),
          field("ai-notice", "aiNotice", "수행평가 시 AI 활용 학생 유의 사항", "multiline"),
        ],
        rubricColumnLabels: ["단계", "평가요소 (평가주체/평가대상)", "배점", "평가 기준"],
      };
  }
}

export function parseEvaluationTemplateSectionConfig(value: unknown): EvaluationTemplateSectionConfig | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;

  switch (value.type) {
    case "teaching_learning_table": {
      const orientation = value.orientation;
      const repeatHeader = value.repeatHeader;
      const fields = parseTeachingFields(value.fields);
      if ((orientation !== "portrait" && orientation !== "landscape") || typeof repeatHeader !== "boolean" || !fields) {
        return undefined;
      }
      const detailHeaderLabel = readOptionalString(value.detailHeaderLabel, 120);
      if (value.detailHeaderLabel !== undefined && detailHeaderLabel === undefined) return undefined;
      return { type: value.type, orientation, repeatHeader, ...(detailHeaderLabel ? { detailHeaderLabel } : {}), fields };
    }
    case "outline_text": {
      if (!Array.isArray(value.numberingLevels) || value.numberingLevels.length === 0 || value.numberingLevels.length > 6) {
        return undefined;
      }
      const numberingLevels = value.numberingLevels.filter(isOutlineNumberingStyle);
      return numberingLevels.length === value.numberingLevels.length ? { type: value.type, numberingLevels } : undefined;
    }
    case "achievement_rate_table": {
      const rateLabel = readString(value.rateLabel, 80);
      const achievementLabel = readString(value.achievementLabel, 80);
      const rows = parseAchievementRateRows(value.rows);
      return rateLabel && achievementLabel && rows ? { type: value.type, rateLabel, achievementLabel, rows } : undefined;
    }
    case "semester_achievement_level_table": {
      const levelLabel = readString(value.levelLabel, 80);
      const statementLabel = readString(value.statementLabel, 120);
      const levels = parseStringArray(value.levels, 2, 10, 20);
      return levelLabel && statementLabel && levels ? { type: value.type, levelLabel, statementLabel, levels } : undefined;
    }
    case "evaluation_method_table": {
      const rowLabels = parseStringArray(value.rowLabels, 1, 20, 100);
      const fields = parseFields(value.fields);
      return rowLabels && fields ? { type: value.type, rowLabels, fields } : undefined;
    }
    case "written_assessment_table": {
      const fields = parseFields(value.fields);
      return fields ? { type: value.type, fields } : undefined;
    }
    case "performance_assessment_table": {
      const headerFields = parseFields(value.headerFields);
      const rubricColumnLabels = parseStringArray(value.rubricColumnLabels, 2, 12, 120);
      return headerFields && rubricColumnLabels ? { type: value.type, headerFields, rubricColumnLabels } : undefined;
    }
    default:
      return undefined;
  }
}

export function getEvaluationTemplateSectionConfigIssues(config: EvaluationTemplateSectionConfig): string[] {
  if (config.type !== "teaching_learning_table") return [];
  if (config.fields.length === 0) return ["교수학습-평가 표에는 입력 항목이 하나 이상 필요합니다."];
  const ids = new Set<string>();
  const fieldKeys = new Set<string>();
  for (const fieldItem of config.fields) {
    if (ids.has(fieldItem.id) || fieldKeys.has(fieldItem.fieldKey)) {
      return ["교수학습-평가 표에 중복된 입력 항목이 있습니다."];
    }
    ids.add(fieldItem.id);
    fieldKeys.add(fieldItem.fieldKey);
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
): TeachingLearningTableField {
  return { id, fieldKey, label, inputKind, source, placement, widthWeight };
}

function field(id: string, fieldKey: string, label: string, inputKind: TemplateFieldInputKind): SectionTemplateField {
  return { id, fieldKey, label, inputKind, source: "teacher" };
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
    result.push({ ...parsed, placement: item.placement, ...(widthWeight === undefined ? {} : { widthWeight }) });
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
  if (!id || !fieldKey || !label || !isTemplateFieldInputKind(inputKind) || !isTemplateFieldSource(source)) return undefined;
  if (!/^[A-Za-z0-9_-]+$/.test(id) || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(fieldKey)) return undefined;
  if (value.required !== undefined && typeof value.required !== "boolean") return undefined;
  return { id, fieldKey, label, inputKind, source, ...(value.required === undefined ? {} : { required: value.required }) };
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

function isOutlineNumberingStyle(value: unknown): value is OutlineNumberingStyle {
  return typeof value === "string" && NUMBERING_STYLES.has(value as OutlineNumberingStyle);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
