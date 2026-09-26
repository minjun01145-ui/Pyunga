"use client";

import Link from "next/link";

import {
  canMoveEvaluationTemplateSection,
  EVALUATION_TEMPLATE_SECTION_LEVELS,
  parseEvaluationTemplateSectionLevel,
  type EvaluationTemplateSection,
  type EvaluationTemplateSectionPatch,
} from "../domain/evaluation-template";
import type { EvaluationTemplateSectionConfig } from "../domain/evaluation-template-section-config";
import { EvaluationTemplateSectionFormatEditor, getEvaluationTemplateSectionFormatLabel, getEvaluationTemplateSectionFormatSummary } from "./EvaluationTemplateSectionFormatEditor";
import { EvaluationTemplateSectionTitleSetting } from "./EvaluationTemplateSectionTitleSetting";
import styles from "./EvaluationTemplateSectionInspector.module.css";

type EvaluationTemplateSectionInspectorProps = {
  sections: readonly EvaluationTemplateSection[];
  selectedSectionId: string | null;
  disabled: boolean;
  onSectionChange: (sectionId: string, patch: EvaluationTemplateSectionPatch) => void;
  onMoveSection: (sectionId: string, direction: -1 | 1) => void;
};

const levelLabels = {
  1: "대분류 제목",
  2: "1. 단위",
  3: "가. 단위",
  4: "1) 단위",
  5: "가) 단위",
  6: "(1) 단위",
  7: "(가) 단위",
} as const;

export function EvaluationTemplateSectionInspector({
  sections,
  selectedSectionId,
  disabled,
  onSectionChange,
  onMoveSection,
}: EvaluationTemplateSectionInspectorProps) {
  const sectionIndex = sections.findIndex((section) => section.id === selectedSectionId);
  const section = sectionIndex < 0 ? undefined : sections[sectionIndex];

  if (!section) {
    return (
      <aside className={`panel ${styles.inspector}`} aria-label="항목 설정">
        <p className="muted small-copy">미리보기에서 설정할 항목을 선택하세요.</p>
      </aside>
    );
  }

  const sectionId = section.id;
  const parentTitle = sections.find((item) => item.id === section.parentId)?.title;
  const hasTable = section.config && section.config.type !== "title_only" && section.config.type !== "outline_text";

  function updateConfig(config: EvaluationTemplateSectionConfig) {
    onSectionChange(sectionId, { config });
  }

  return (
    <aside className={`panel ${styles.inspector}`} aria-label="선택한 항목 설정">
      <div className={styles.header}>
        <h2 className="subsection-title">{section.title || "제목 없는 항목"}</h2>
        <p className="muted small-copy">
          {section.parentId ? `상위 항목: ${parentTitle ?? "없음"}` : "상위 항목 없음"}
          {section.sourcePage ? ` · 원문 ${section.sourcePage}쪽` : ""}
        </p>
      </div>

      <fieldset className={styles.controls} disabled={disabled}>
        <legend className={styles.visuallyHidden}>선택 항목 수정</legend>
        <EvaluationTemplateSectionTitleSetting
          sectionId={section.id}
          title={section.title}
          teacherEditableTitle={section.teacherEditableTitle}
          onTitleChange={(title) => onSectionChange(section.id, { title })}
          onTeacherEditableTitleChange={(teacherEditableTitle) =>
            onSectionChange(section.id, { teacherEditableTitle })
          }
        />

        <label className={`field ${styles.levelField}`}>
          <span>제목 단계</span>
          <select
            value={section.level}
            onChange={(event) => {
              const level = parseEvaluationTemplateSectionLevel(event.target.value);
              if (level !== undefined) onSectionChange(section.id, { level });
            }}
          >
            {EVALUATION_TEMPLATE_SECTION_LEVELS.map((level) => (
              <option key={level} value={level}>{level}단계 · {levelLabels[level]}</option>
            ))}
          </select>
        </label>

        <div className={styles.formatSummary}>
          <h3>현재 입력 양식</h3>
          <strong>{getEvaluationTemplateSectionFormatLabel(section.config)}</strong>
          <p className="muted small-copy">{getEvaluationTemplateSectionFormatSummary(section.config)}</p>
        </div>

        <details key={section.id} className={styles.formatDetails}>
          <summary>{hasTable ? "표 세부 설정" : section.config ? "세부 양식 설정" : "입력 양식 설정"}</summary>
          <EvaluationTemplateSectionFormatEditor
            config={section.config}
            compact
            disabled={disabled}
            onChange={updateConfig}
          />
        </details>

        <div className={styles.actions}>
          <button
            className="text-button"
            type="button"
            disabled={!canMoveEvaluationTemplateSection(sections, sectionIndex, -1)}
            onClick={() => onMoveSection(section.id, -1)}
          >
            위로 이동
          </button>
          <button
            className="text-button"
            type="button"
            disabled={!canMoveEvaluationTemplateSection(sections, sectionIndex, 1)}
            onClick={() => onMoveSection(section.id, 1)}
          >
            아래로 이동
          </button>
        </div>

        <Link
          className={styles.existingEditorLink}
          href={`/admin/evaluation/template/current/${encodeURIComponent(section.id)}`}
        >
          기존 세부 설정 열기
        </Link>
      </fieldset>
    </aside>
  );
}
