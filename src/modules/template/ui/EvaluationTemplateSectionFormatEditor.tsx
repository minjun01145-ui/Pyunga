"use client";

import { useState } from "react";

import {
  EVALUATION_TEMPLATE_SECTION_FORMAT_TYPES,
  createDefaultEvaluationTemplateSectionConfig,
  type EvaluationTemplateSectionConfig,
  type EvaluationTemplateSectionFormatType,
} from "../domain/evaluation-template-section-config";
import { TeachingLearningTableTemplateEditor } from "./TeachingLearningTableTemplateEditor";
import { TeachingLearningTableTemplatePreview } from "./TeachingLearningTableTemplatePreview";
import styles from "./EvaluationTemplateCurrentSectionWorkspace.module.css";

type EvaluationTemplateSectionFormatEditorProps = {
  config?: EvaluationTemplateSectionConfig;
  onChange: (config: EvaluationTemplateSectionConfig) => void;
};

const formatLabels: Record<EvaluationTemplateSectionFormatType, string> = {
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

  if (config.type === "teaching_learning_table") {
    return (
      <div className={styles.formatConfigured}>
        <div className={styles.formatHeader}>
          <div>
            <h2 className="subsection-title">교수학습-평가 입력 양식</h2>
            <p className="muted small-copy">교과에서 실제 입력할 항목과 표 배치를 지정합니다.</p>
          </div>
          <FormatTypeChanger config={config} selectedType={selectedType} onSelectedTypeChange={setSelectedType} onChange={onChange} />
        </div>
        <TeachingLearningTableTemplateEditor config={config} onChange={onChange} />
        <div className={styles.previewPanel}>
          <h3 className="subsection-title">표 미리보기</h3>
          <TeachingLearningTableTemplatePreview config={config} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formatConfigured}>
      <div className={styles.formatHeader}>
        <div>
          <h2 className="subsection-title">{formatLabels[config.type]}</h2>
          <p className="muted small-copy">PDF에서 읽은 입력 구조 또는 평가계가 지정한 기본 양식입니다.</p>
        </div>
        <FormatTypeChanger config={config} selectedType={selectedType} onSelectedTypeChange={setSelectedType} onChange={onChange} />
      </div>
      <SectionFormatSummary config={config} />
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
        onClick={() => onChange(createDefaultEvaluationTemplateSectionConfig(selectedType))}
      >
        유형 변경
      </button>
    </div>
  );
}

function SectionFormatSummary({ config }: { config: Exclude<EvaluationTemplateSectionConfig, { type: "teaching_learning_table" }> }) {
  switch (config.type) {
    case "outline_text":
      return <p className="small-copy">번호 단계: {config.numberingLevels.map(numberingLabel).join(" → ")}</p>;
    case "achievement_rate_table":
      return (
        <table className="simple-table compact-table">
          <thead><tr><th>{config.rateLabel}</th><th>{config.achievementLabel}</th></tr></thead>
          <tbody>{config.rows.map((row) => <tr key={`${row.achievement}-${row.rate}`}><td>{row.rate}</td><td>{row.achievement}</td></tr>)}</tbody>
        </table>
      );
    case "semester_achievement_level_table":
      return <p className="small-copy">{config.levelLabel}: {config.levels.join(", ")} · {config.statementLabel}</p>;
    case "evaluation_method_table":
      return <p className="small-copy">행 구성: {config.rowLabels.join(" / ")} · 입력 항목: {config.fields.map((fieldItem) => fieldItem.label).join(", ")}</p>;
    case "written_assessment_table":
      return <p className="small-copy">열 구성: {config.fields.map((fieldItem) => fieldItem.label).join(" / ")}</p>;
    case "performance_assessment_table":
      return <p className="small-copy">상단 입력: {config.headerFields.map((fieldItem) => fieldItem.label).join(" / ")} · 채점표: {config.rubricColumnLabels.join(" / ")}</p>;
  }
}

function parseFormatType(value: string): EvaluationTemplateSectionFormatType {
  switch (value) {
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
