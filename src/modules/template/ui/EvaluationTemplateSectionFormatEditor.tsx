"use client";

import { useState } from "react";

import {
  buildAcademicCalendarTeachingPeriods,
  resolveAcademicCalendarSemesterRange,
  type AcademicCalendarEvent,
  type AcademicCalendarTeachingPeriod,
} from "@/modules/academic-calendar";
import { authenticatedFetch } from "@/modules/auth/client";
import { EVALUATION_DEMO_CONTEXT } from "@/shared/demo/evaluation-demo-context";
import {
  EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES,
  createDefaultEvaluationTemplateSectionConfig,
  type EvaluationTemplateSectionConfig,
  type EvaluationTemplateSectionFormatType,
} from "../domain/evaluation-template-section-config";
import type { TableTemplateDocument } from "../domain/table-template";
import { TableTemplateEditor } from "./TableTemplateEditor";
import { TeachingLearningCalendarPreview } from "./TeachingLearningCalendarPreview";
import styles from "./EvaluationTemplateCurrentSectionWorkspace.module.css";

type EvaluationTemplateSectionFormatEditorProps = {
  config?: EvaluationTemplateSectionConfig;
  compact?: boolean;
  disabled?: boolean;
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

export function getEvaluationTemplateSectionFormatLabel(
  config?: EvaluationTemplateSectionConfig,
): string {
  return config ? formatLabels[config.type] : "양식 미설정";
}

export function getEvaluationTemplateSectionFormatSummary(
  config?: EvaluationTemplateSectionConfig,
): string {
  if (!config) return "입력 양식이 지정되지 않았습니다.";
  if (config.type === "title_only") return "본문 없이 제목만 표시합니다.";
  if (config.type === "outline_text") {
    const numbering = config.numberingLevels.map(numberingLabel).join(" → ");
    return `번호 단계 ${numbering} · 학교 공통 문구 ${config.commonText?.trim() ? "입력됨" : "없음"}`;
  }

  const details = [
    config.layout.orientation === "landscape" ? "가로" : "세로",
    `머리글 ${config.layout.repeatHeader ? "반복" : "반복 안 함"}`,
  ];
  if (config.type === "teaching_learning_table") {
    details.push(config.calendarRows.enabled
      ? `학사일정 행 ${config.calendarRows.periodUnit === "month" ? "월 단위" : "주 단위"}`
      : "학사일정 행 미사용");
  }
  return details.join(" · ");
}

export function EvaluationTemplateSectionFormatEditor({
  config,
  compact = false,
  disabled = false,
  onChange,
}: EvaluationTemplateSectionFormatEditorProps) {
  const [selectedType, setSelectedType] = useState<EvaluationTemplateSectionFormatType>(
    config?.type ?? "teaching_learning_table",
  );
  const [calendarPreviewPeriods, setCalendarPreviewPeriods] = useState<AcademicCalendarTeachingPeriod[]>();
  const [calendarPreviewError, setCalendarPreviewError] = useState<string>();
  const [isGeneratingCalendarRows, setIsGeneratingCalendarRows] = useState(false);

  function handleConfigChange(nextConfig: EvaluationTemplateSectionConfig) {
    if (nextConfig.type !== config?.type) {
      setCalendarPreviewPeriods(undefined);
      setCalendarPreviewError(undefined);
    }
    onChange(nextConfig);
  }

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
          onClick={() => handleConfigChange(createDefaultEvaluationTemplateSectionConfig(selectedType))}
        >
          이 양식으로 설정
        </button>
      </div>
    );
  }

  return (
    <div className={`${styles.formatConfigured} ${compact ? styles.compact : ""}`}>
      <div className={styles.formatHeader}>
        <div>
          <h2 className="subsection-title">{getEvaluationTemplateSectionFormatLabel(config)}</h2>
          <p className="muted small-copy">
            {config.type === "title_only"
              ? "본문 없이 제목만 문서에 표시합니다."
              : config.type === "outline_text"
              ? "번호 단계와 본문 작성 방식을 지정합니다."
              : "표 안에서 직접 글자와 셀 구조를 수정하세요."}
          </p>
        </div>
        <FormatTypeChanger config={config} selectedType={selectedType} onSelectedTypeChange={setSelectedType} onChange={handleConfigChange} />
      </div>
      {config.type === "title_only" ? (
        <p className="small-copy">이 항목은 교과 입력칸 없이 제목만 최종 문서에 표시됩니다.</p>
      ) : config.type === "outline_text" ? (
        <>
          <p className="small-copy">번호 단계: {config.numberingLevels.map(numberingLabel).join(" → ")}</p>
          <label className="field">
            <span>학교 공통 문구·평가 처리 방침</span>
            <textarea
              rows={8}
              maxLength={30_000}
              value={config.commonText ?? ""}
              onChange={(event) => handleConfigChange({ ...config, commonText: event.target.value })}
            />
          </label>
          <p className="muted small-copy">입력한 문구는 모든 과목 계획에 공통으로 표시되며 과목교사가 수정할 수 없습니다.</p>
        </>
      ) : (
        <>
          <TableLayoutOptions config={config} onChange={handleConfigChange} />
          {config.type === "teaching_learning_table" ? (
            <TeachingLearningCalendarOptions
              config={config}
              isGenerating={isGeneratingCalendarRows}
              onChange={(nextConfig) => {
                setCalendarPreviewPeriods(undefined);
                setCalendarPreviewError(undefined);
                handleConfigChange(nextConfig);
              }}
              onGenerate={() => void generateCalendarRows(config)}
            />
          ) : null}
          {calendarPreviewError ? <p className="validation-error-box">{calendarPreviewError}</p> : null}
          {config.type === "teaching_learning_table" && calendarPreviewPeriods ? (
            <TeachingLearningCalendarPreview
              config={config}
              periods={calendarPreviewPeriods}
              onChange={handleConfigChange}
            />
          ) : null}
          {config.type === "teaching_learning_table" ? (
            <h3 className="subsection-title">표 구조 편집</h3>
          ) : null}
          <TableTemplateEditor
            key={config.type}
            document={config.table}
            editable={!disabled}
            compact={compact}
            onChange={(table) => handleConfigChange(withTable(config, table))}
          />
        </>
      )}
    </div>
  );

  async function generateCalendarRows(currentConfig: Extract<EvaluationTemplateSectionConfig, { type: "teaching_learning_table" }>) {
    setIsGeneratingCalendarRows(true);
    setCalendarPreviewError(undefined);
    try {
      const response = await authenticatedFetch(
        `/api/admin/evaluation/academic-calendar?academicYear=${EVALUATION_DEMO_CONTEXT.academicYear}`,
      );
      const body = (await response.json()) as { events?: AcademicCalendarEvent[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "학사일정을 불러오지 못했습니다.");
      const events = body.events ?? [];
      const range = resolveAcademicCalendarSemesterRange(events, EVALUATION_DEMO_CONTEXT.semester);
      if (!range) throw new Error("현재 학기의 학사일정이 없어 자동 행을 생성할 수 없습니다.");
      const periods = buildAcademicCalendarTeachingPeriods(events, {
        semester: EVALUATION_DEMO_CONTEXT.semester,
        grade: EVALUATION_DEMO_CONTEXT.grade,
        unit: currentConfig.calendarRows.periodUnit,
        range,
      });
      if (periods.length === 0) throw new Error("현재 학기·학년에 적용할 자동 행이 없습니다.");
      setCalendarPreviewPeriods(periods);
    } catch (error) {
      setCalendarPreviewPeriods(undefined);
      setCalendarPreviewError(error instanceof Error ? error.message : "자동 행 생성에 실패했습니다.");
    } finally {
      setIsGeneratingCalendarRows(false);
    }
  }
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
  isGenerating,
  onChange,
  onGenerate,
}: {
  config: Extract<EvaluationTemplateSectionConfig, { type: "teaching_learning_table" }>;
  isGenerating: boolean;
  onChange: (config: EvaluationTemplateSectionConfig) => void;
  onGenerate: () => void;
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
      {config.calendarRows.enabled ? (
        <button
          className="secondary-button"
          type="button"
          disabled={isGenerating}
          onClick={onGenerate}
        >
          {isGenerating ? "학사일정 불러오는 중" : "자동 행 생성"}
        </button>
      ) : null}
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
