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
  getTableTemplateLeadingHeaderRowCount,
  parseTableTemplateDocument,
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

export function parseCanonicalEvaluationTemplateSectionConfig(
  value: unknown,
): EvaluationTemplateSectionConfig | undefined {
  if (!isRecord(value) || typeof value.type !== "string") return undefined;

  switch (value.type) {
    case "title_only":
      return { type: value.type };
    case "teaching_learning_table": {
      const layout = parseTableLayout(value.layout);
      const table = parseTableTemplateDocument(value.table);
      const calendarRows = parseTeachingLearningCalendarRows(value.calendarRows);
      return layout && table && calendarRows
        ? { type: value.type, layout, table, calendarRows }
        : undefined;
    }
    case "outline_text": {
      if (!Array.isArray(value.numberingLevels) || value.numberingLevels.length === 0 || value.numberingLevels.length > 6) {
        return undefined;
      }
      const numberingLevels = value.numberingLevels.filter(isOutlineNumberingStyle);
      return numberingLevels.length === value.numberingLevels.length ? { type: value.type, numberingLevels } : undefined;
    }
    case "achievement_rate_table":
    case "semester_achievement_level_table":
    case "evaluation_method_table":
    case "written_assessment_table":
    case "performance_assessment_table": {
      const layout = parseTableLayout(value.layout);
      const table = parseTableTemplateDocument(value.table);
      return layout && table ? { type: value.type, layout, table } : undefined;
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
): TeachingLearningTableFieldDraft {
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

function field(
  id: string,
  fieldKey: string,
  label: string,
  inputKind: TemplateFieldInputKind,
): SectionTemplateFieldDraft {
  return { id, fieldKey, label, inputKind, source: "teacher" };
}

function defaultTableLayout(): TableLayoutPolicy {
  return { orientation: "portrait", repeatHeader: true };
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

function parseTeachingLearningCalendarRows(
  value: unknown,
): TeachingLearningTableConfig["calendarRows"] | undefined {
  if (!isRecord(value) || typeof value.enabled !== "boolean") return undefined;
  if (value.periodUnit !== "month" && value.periodUnit !== "month_week") return undefined;
  return { enabled: value.enabled, periodUnit: value.periodUnit };
}

function isOutlineNumberingStyle(value: unknown): value is OutlineNumberingStyle {
  return typeof value === "string" && NUMBERING_STYLES.has(value as OutlineNumberingStyle);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
