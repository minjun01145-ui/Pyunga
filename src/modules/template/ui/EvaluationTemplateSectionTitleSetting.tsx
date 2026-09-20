"use client";

import styles from "./EvaluationTemplateSectionWorkspace.module.css";

type EvaluationTemplateSectionTitleSettingProps = {
  sectionId: string;
  title: string;
  teacherEditableTitle: boolean;
  onTitleChange: (title: string) => void;
  onTeacherEditableTitleChange: (enabled: boolean) => void;
};

export function EvaluationTemplateSectionTitleSetting({
  sectionId,
  title,
  teacherEditableTitle,
  onTitleChange,
  onTeacherEditableTitleChange,
}: EvaluationTemplateSectionTitleSettingProps) {
  const inputId = `template-section-title-${sectionId}`;

  return (
    <div className={`field ${styles.titleField}`}>
      <div className={styles.titleFieldHeader}>
        <label htmlFor={inputId}>제목</label>
        <label className={styles.teacherEditableTitleToggle}>
          <input
            type="checkbox"
            checked={teacherEditableTitle}
            onChange={(event) => onTeacherEditableTitleChange(event.target.checked)}
          />
          <span>교과에서 제목 설정 가능</span>
        </label>
      </div>
      <input
        id={inputId}
        maxLength={120}
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
      />
      {teacherEditableTitle ? (
        <p className={styles.teacherEditableTitleHint}>
          현재 입력한 제목은 교과 선생님에게 회색 예시 제목으로 표시되며, 교과에서 실제 제목을 수정할 수 있습니다.
        </p>
      ) : null}
    </div>
  );
}
