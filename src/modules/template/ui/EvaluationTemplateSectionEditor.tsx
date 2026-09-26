"use client";

import {
  canMoveEvaluationTemplateSection,
  EVALUATION_TEMPLATE_SECTION_LEVELS,
  moveEvaluationTemplateSection,
  normalizeEvaluationTemplateSections,
  parseEvaluationTemplateSectionLevel,
  removeEvaluationTemplateSection,
  updateEvaluationTemplateSection,
  type EvaluationTemplate,
  type EvaluationTemplateSection,
  type EvaluationTemplateSectionInput,
  type EvaluationTemplateSectionLevel,
} from "../domain/evaluation-template";
import { EvaluationTemplateSectionTitleSetting } from "./EvaluationTemplateSectionTitleSetting";
import styles from "./EvaluationTemplateSectionWorkspace.module.css";

type EvaluationTemplateSectionEditorProps = {
  template: EvaluationTemplate;
  onChange: (template: EvaluationTemplate) => void;
};

const levelLabels: Record<EvaluationTemplateSectionLevel, string> = {
  1: "대분류(제목)",
  2: "1. 단위",
  3: "가. 단위",
  4: "1) 단위",
  5: "가) 단위",
  6: "(1) 단위",
  7: "(가) 단위",
};

export function EvaluationTemplateSectionEditor({
  template,
  onChange,
}: EvaluationTemplateSectionEditorProps) {
  const titleById = new Map(template.sections.map((section) => [section.id, section.title]));

  function updateSection(sectionId: string, patch: Partial<Omit<EvaluationTemplateSectionInput, "id">>) {
    onChange({ ...template, sections: updateEvaluationTemplateSection(template.sections, sectionId, patch) });
  }

  function moveSection(index: number, direction: -1 | 1) {
    onChange({ ...template, sections: moveEvaluationTemplateSection(template.sections, index, direction) });
  }

  function removeSection(index: number) {
    onChange({ ...template, sections: removeEvaluationTemplateSection(template.sections, index) });
  }

  function addSection() {
    const nextInput: EvaluationTemplateSectionInput = {
      id: createSectionId(),
      title: "새 항목",
      level: 1,
      teacherEditableTitle: false,
    };
    onChange({
      ...template,
      sections: normalizeEvaluationTemplateSections([...template.sections.map(toSectionInput), nextInput]),
    });
  }

  return (
    <>
      <div className={styles.sectionList}>
        {template.sections.map((section, index) => (
          <div
            className={`${styles.sectionRow} ${styles[`level${section.level}`]}`}
            key={section.id}
          >
            <label className={`field ${styles.levelField}`}>
              <span>단계</span>
              <select
                value={section.level}
                onChange={(changeEvent) =>
                  updateSection(section.id, {
                    level: parseEvaluationTemplateSectionLevel(changeEvent.target.value) ?? 1,
                  })
                }
              >
                {EVALUATION_TEMPLATE_SECTION_LEVELS.map((level) => (
                  <option key={level} value={level}>{levelLabels[level]}</option>
                ))}
              </select>
            </label>

            <EvaluationTemplateSectionTitleSetting
              sectionId={section.id}
              title={section.title}
              teacherEditableTitle={section.teacherEditableTitle}
              onTitleChange={(title) => updateSection(section.id, { title })}
              onTeacherEditableTitleChange={(teacherEditableTitle) =>
                updateSection(section.id, { teacherEditableTitle })
              }
            />

            <div className={styles.metaField}>
              <span>상위 항목</span>
              <strong>{section.parentId ? titleById.get(section.parentId) ?? "-" : "-"}</strong>
            </div>

            <div className={styles.metaField}>
              <span>원문</span>
              <strong>{section.sourcePage ? `${section.sourcePage}쪽` : "-"}</strong>
            </div>

            <div className={styles.rowActions} aria-label={`${section.title} 순서 및 삭제`}>
              <button
                className="text-button"
                type="button"
                disabled={!canMoveEvaluationTemplateSection(template.sections, index, -1)}
                onClick={() => moveSection(index, -1)}
              >
                위
              </button>
              <button
                className="text-button"
                type="button"
                disabled={!canMoveEvaluationTemplateSection(template.sections, index, 1)}
                onClick={() => moveSection(index, 1)}
              >
                아래
              </button>
              <button className="text-button danger-text" type="button" onClick={() => removeSection(index)}>
                삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      <button className="secondary-button" type="button" onClick={addSection}>항목 추가</button>
    </>
  );
}

function toSectionInput(section: EvaluationTemplateSection): EvaluationTemplateSectionInput {
  return {
    id: section.id,
    title: section.title,
    level: section.level,
    teacherEditableTitle: section.teacherEditableTitle,
    ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
    ...(section.config ? { config: section.config } : {}),
  };
}

function createSectionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `section-${crypto.randomUUID()}`
    : `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
