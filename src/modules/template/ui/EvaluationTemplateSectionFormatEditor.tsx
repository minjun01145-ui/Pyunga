"use client";

import { useState } from "react";

import {
  EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES,
  createDefaultEvaluationTemplateSectionConfig,
  type EvaluationTemplateSectionConfig,
  type EvaluationTemplateSectionFormatType,
} from "../domain/evaluation-template-section-config";
import type { TableTemplateDocument } from "../domain/table-template";
import { TableTemplateEditor } from "./TableTemplateEditor";
import styles from "./EvaluationTemplateCurrentSectionWorkspace.module.css";

type EvaluationTemplateSectionFormatEditorProps = {
  config?: EvaluationTemplateSectionConfig;
  onChange: (config: EvaluationTemplateSectionConfig) => void;
};

const formatLabels: Record<EvaluationTemplateSectionFormatType, string> = {
  title_only: "제목만",
  teaching_learning_table: "교수학습-평가 표",
  outline_text: "개조식 본문",
  achievement_rate_table: "기준 성취율 표",
  semester_achievement_level_table: "학기단위 성취수준 표",
  evaluation_method_table: "평가 방법 표",
  written_assessment_table: "정기시험 계획 표",
  performance_assessment_table: "수행평가 계획 표",
};

export function EvaluationTemplateSectionFormatEditor({
  config,
  onChange,
}: EvaluationTemplateSectionFormatEditorProps) {
  const [selectedType, setSelectedType] = useState<EvaluationTemplateSectionFormatType>(
    config?.type ?? "teaching_learning_table",
  );

  if (!config) {
    return (
      <div className={styles.formatPrompt}>
        <h2 className="subsection-title">이 부분의 양식을 먼저 지정해 주세요.</h2>
        <p className="muted small-copy">
          대분류 관리에서 평가계획 PDF를 불러온 경우 분석된 표·입력 양식이 여기에 표시됩니다. 직접 지정할 수도 있습니다.
        </p>
        <label className="field">
          <span>입력 양식</span>
          <select value={selectedType} onChange={(event) => setSelectedType(parseFormatType(event.target.value))}>
            {EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES.map((type) => (
              <option key={type} value={type}>{formatLabels[type]}</option>
            ))}
          </select>
        </label>
        <button
          className="secondary-button align-start"
          type="button"
          onClick={() => onChange(createDefaultEvaluationTemplateSectionConfig(selectedType))}
        >
          이 양식으로 설정
        </button>
      </div>
    );
  }

  return (
    <div className={styles.formatConfigured}>
      <div className={styles.formatHeader}>
        <div>
          <h2 className="subsection-title">{formatLabels[config.type]}</h2>
          <p className="muted small-copy">
            {config.type === "title_only"
              ? "본문 없이 제목만 문서에 표시합니다."
              : config.type === "outline_text"
              ? "번호 단계와 본문 작성 방식을 지정합니다."
              : "표 안에서 직접 글자와 셀 구조를 수정하세요."}
          </p>
        </div>
        <FormatTypeChanger config={config} selectedType={selectedType} onSelectedTypeChange={setSelectedType} onChange={onChange} />
      </div>
      {config.type === "title_only" ? (
        <p className="small-copy">이 항목은 교과 입력칸 없이 제목만 최종 문서에 표시됩니다.</p>
      ) : config.type === "outline_text" ? (
        <p className="small-copy">번호 단계: {config.numberingLevels.map(numberingLabel).join(" → ")}</p>
      ) : (
        <>
          <TableLayoutOptions config={config} onChange={onChange} />
          {config.type === "teaching_learning_table" ? (
            <TeachingLearningCalendarOptions config={config} onChange={onChange} />
          ) : null}
          <TableTemplateEditor
            key={config.type}
            document={config.table}
            allowAcademicCalendarSystemValues={config.type === "teaching_learning_table"}
            onChange={(table) => onChange(withTable(config, table))}
          />
        </>
      )}
    </div>
  );
}

function FormatTypeChanger({
  config,
  selectedType,
  onSelectedTypeChange,
  onChange,
}: {
  config: EvaluationTemplateSectionConfig;
  selectedType: EvaluationTemplateSectionFormatType;
  onSelectedTypeChange: (type: EvaluationTemplateSectionFormatType) => void;
  onChange: (config: EvaluationTemplateSectionConfig) => void;
}) {
  return (
    <div className={styles.formatTypeChange}>
      <select value={selectedType} onChange={(event) => onSelectedTypeChange(parseFormatType(event.target.value))}>
        {EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES.map((type) => (
          <option key={type} value={type}>{formatLabels[type]}</option>
        ))}
      </select>
      <button
        className="text-button"
        type="button"
        disabled={selectedType === config.type}
        onClick={() => {
          if (
            !window.confirm(
              "양식 유형을 바꾸면 현재 표에서 수정한 행·열·셀 내용이 새 기본 양식으로 바뀝니다. 계속하시겠습니까?",
            )
          ) {
            return;
          }
          onChange(createDefaultEvaluationTemplateSectionConfig(selectedType));
        }}
      >
        유형 변경
      </button>
    </div>
  );
}

function TableLayoutOptions({
  config,
  onChange,
}: {
  config: Exclude<EvaluationTemplateSectionConfig, { type: "title_only" | "outline_text" }>;
  onChange: (config: EvaluationTemplateSectionConfig) => void;
}) {
  return (
    <div className={styles.tableOptions}>
      <label className="field">
        <span>페이지 방향</span>
        <select
          value={config.layout.orientation}
          onChange={(event) =>
            onChange({
              ...config,
              layout: {
                ...config.layout,
                orientation: event.target.value === "landscape" ? "landscape" : "portrait",
              },
            })
          }
        >
          <option value="portrait">세로</option>
          <option value="landscape">가로</option>
        </select>
      </label>
      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={config.layout.repeatHeader}
          onChange={(event) =>
            onChange({
              ...config,
              layout: { ...config.layout, repeatHeader: event.target.checked },
            })
          }
        />
        <span>페이지가 넘어가면 머리글 반복</span>
      </label>
    </div>
  );
}

function TeachingLearningCalendarOptions({
  config,
  onChange,
}: {
  config: Extract<EvaluationTemplateSectionConfig, { type: "teaching_learning_table" }>;
  onChange: (config: EvaluationTemplateSectionConfig) => void;
}) {
  return (
    <div className={styles.tableOptions}>
      <label className={styles.checkboxField}>
        <input
          type="checkbox"
          checked={config.calendarRows.enabled}
          onChange={(event) => onChange({
            ...config,
            calendarRows: { ...config.calendarRows, enabled: event.target.checked },
          })}
        />
        <span>학사일정 기준으로 교과 입력 행 자동 생성</span>
      </label>
      <label className="field">
        <span>자동 생성 행 기준</span>
        <select
          value={config.calendarRows.periodUnit}
          disabled={!config.calendarRows.enabled}
          onChange={(event) => onChange({
            ...config,
            calendarRows: {
              ...config.calendarRows,
              periodUnit: event.target.value === "month" ? "month" : "month_week",
            },
          })}
        >
          <option value="month">월 단위</option>
          <option value="month_week">주 단위 (월·주·기간·주요일정 사용 가능)</option>
        </select>
      </label>
    </div>
  );
}

function withTable(
  config: Exclude<EvaluationTemplateSectionConfig, { type: "title_only" | "outline_text" }>,
  table: TableTemplateDocument,
): EvaluationTemplateSectionConfig {
  switch (config.type) {
    case "teaching_learning_table": return { ...config, table };
    case "achievement_rate_table": return { ...config, table };
    case "semester_achievement_level_table": return { ...config, table };
    case "evaluation_method_table": return { ...config, table };
    case "written_assessment_table": return { ...config, table };
    case "performance_assessment_table": return { ...config, table };
  }
}

function parseFormatType(value: string): EvaluationTemplateSectionFormatType {
  switch (value) {
    case "title_only": return "title_only";
    case "outline_text": return "outline_text";
    case "achievement_rate_table": return "achievement_rate_table";
    case "semester_achievement_level_table": return "semester_achievement_level_table";
    case "evaluation_method_table": return "evaluation_method_table";
    case "written_assessment_table": return "written_assessment_table";
    case "performance_assessment_table": return "performance_assessment_table";
    default: return "teaching_learning_table";
  }
}

function numberingLabel(value: string): string {
  switch (value) {
    case "decimal_dot": return "1.";
    case "korean_dot": return "가.";
    case "decimal_paren": return "1)";
    case "korean_paren": return "가)";
    case "decimal_bracket": return "(1)";
    case "korean_bracket": return "(가)";
    default: return value;
  }
}
