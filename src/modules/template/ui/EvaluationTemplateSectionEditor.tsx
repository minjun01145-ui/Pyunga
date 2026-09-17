"use client";

import {
  canMoveEvaluationTemplateSection,
  getEvaluationTemplateDirectChildren,
  moveEvaluationTemplateSection,
  normalizeEvaluationTemplateSections,
  removeEvaluationTemplateSection,
  setEvaluationTemplateSectionChildrenMode,
  type EvaluationTemplate,
  type EvaluationTemplateChildrenMode,
  type EvaluationTemplateSection,
  type EvaluationTemplateSectionInput,
  type EvaluationTemplateSectionLevel,
} from "../domain/evaluation-template";
import styles from "./EvaluationTemplateSectionWorkspace.module.css";

type EvaluationTemplateSectionEditorProps = {
  template: EvaluationTemplate;
  onChange: (template: EvaluationTemplate) => void;
  onExcludedChildren: (
    parent: EvaluationTemplateSection,
    children: readonly EvaluationTemplateSection[],
  ) => void;
};

const levelLabels: Record<EvaluationTemplateSectionLevel, string> = {
  1: "대분류",
  2: "중분류",
  3: "소분류",
};

const childrenModeLabels: Record<EvaluationTemplateChildrenMode, string> = {
  fixed: "공통 하위 항목",
  repeatable: "교과별 반복 항목",
};

const levels: EvaluationTemplateSectionLevel[] = [1, 2, 3];

export function EvaluationTemplateSectionEditor({
  template,
  onChange,
  onExcludedChildren,
}: EvaluationTemplateSectionEditorProps) {
  const titleById = new Map(template.sections.map((section) => [section.id, section.title]));

  function updateSection(index: number, patch: Partial<EvaluationTemplateSectionInput>) {
    const inputs = template.sections.map(toSectionInput);
    inputs[index] = { ...inputs[index], ...patch };
    onChange({ ...template, sections: normalizeEvaluationTemplateSections(inputs) });
  }

  function moveSection(index: number, direction: -1 | 1) {
    onChange({ ...template, sections: moveEvaluationTemplateSection(template.sections, index, direction) });
  }

  function removeSection(index: number) {
    onChange({ ...template, sections: removeEvaluationTemplateSection(template.sections, index) });
  }

  function changeChildrenMode(index: number, childrenMode: EvaluationTemplateChildrenMode) {
    const section = template.sections[index];
    if (section.level === 3 || section.childrenMode === childrenMode) return;

    if (childrenMode === "repeatable") {
      const directChildren = getEvaluationTemplateDirectChildren(template.sections, section.id);
      if (directChildren.length > 0) {
        const confirmed = window.confirm(
          "교과별 반복 항목으로 바꾸면 현재 공통 하위 항목은 학교 양식에서 제외됩니다. 계속할까요?",
        );
        if (!confirmed) return;
        onExcludedChildren(section, directChildren);
      }
    }

    onChange({
      ...template,
      sections: setEvaluationTemplateSectionChildrenMode(template.sections, index, childrenMode),
    });
  }

  function addSection() {
    const nextInput: EvaluationTemplateSectionInput = {
      id: createSectionId(),
      title: "새 항목",
      level: 1,
      childrenMode: "fixed",
    };
    onChange({
      ...template,
      sections: normalizeEvaluationTemplateSections([...template.sections.map(toSectionInput), nextInput]),
    });
  }

  return (
    <>
      <div className={styles.modeGuide}>
        <div>
          <strong>공통 하위 항목</strong>
          <span>모든 교과가 같은 제목 구조를 사용합니다. 예: 학기단위 성취수준</span>
        </div>
        <div>
          <strong>교과별 반복 항목</strong>
          <span>항목 이름과 개수는 교과마다 달라집니다. 예: 수행평가별 평가명</span>
        </div>
      </div>

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
                  updateSection(index, { level: parseSectionLevel(changeEvent.target.value) })
                }
              >
                {levels.map((level) => (
                  <option key={level} value={level}>{levelLabels[level]}</option>
                ))}
              </select>
            </label>

            <label className={`field ${styles.titleField}`}>
              <span>제목</span>
              <input
                maxLength={120}
                value={section.title}
                onChange={(changeEvent) => updateSection(index, { title: changeEvent.target.value })}
              />
            </label>

            <label className={`field ${styles.modeField}`}>
              <span>하위 구성</span>
              {section.level === 3 ? (
                <span className={styles.readOnlyValue}>하위 항목 없음</span>
              ) : (
                <select
                  value={section.childrenMode}
                  onChange={(changeEvent) =>
                    changeChildrenMode(index, parseChildrenMode(changeEvent.target.value))
                  }
                >
                  <option value="fixed">{childrenModeLabels.fixed}</option>
                  <option value="repeatable">{childrenModeLabels.repeatable}</option>
                </select>
              )}
            </label>

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
    childrenMode: section.childrenMode,
    ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
  };
}

function parseSectionLevel(value: string): EvaluationTemplateSectionLevel {
  if (value === "2") return 2;
  if (value === "3") return 3;
  return 1;
}

function parseChildrenMode(value: string): EvaluationTemplateChildrenMode {
  return value === "repeatable" ? "repeatable" : "fixed";
}

function createSectionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `section-${crypto.randomUUID()}`
    : `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
