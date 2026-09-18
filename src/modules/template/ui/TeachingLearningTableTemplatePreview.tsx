import type { TeachingLearningTableConfig } from "../domain/evaluation-template-section-config";
import styles from "./EvaluationTemplateCurrentSectionWorkspace.module.css";

type TeachingLearningTableTemplatePreviewProps = {
  config: TeachingLearningTableConfig;
};

export function TeachingLearningTableTemplatePreview({ config }: TeachingLearningTableTemplatePreviewProps) {
  const mainFields = config.fields.filter((fieldItem) => fieldItem.placement === "main");
  const detailFields = config.fields.filter((fieldItem) => fieldItem.placement === "detail");

  if (mainFields.length === 0 && detailFields.length === 0) {
    return <p className="muted small-copy">미리볼 입력 항목이 없습니다.</p>;
  }

  return (
    <div className={styles.previewScroll}>
      <table className={`simple-table ${styles.previewTable}`}>
        <thead>
          <tr>
            {mainFields.map((fieldItem) => (
              <th key={fieldItem.id} rowSpan={detailFields.length > 0 ? 1 : undefined}>{fieldItem.label}</th>
            ))}
            {detailFields.length > 0 ? (
              <th colSpan={2}>{config.detailHeaderLabel ?? "수업·평가 방법"}</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {detailFields.length > 0 ? detailFields.map((fieldItem, index) => (
            <tr key={fieldItem.id}>
              {index === 0 ? mainFields.map((mainField) => (
                <td key={mainField.id} rowSpan={detailFields.length}>
                  <span className={styles.previewPlaceholder}>{previewPlaceholder(mainField.inputKind)}</span>
                </td>
              )) : null}
              <th className={styles.detailLabelCell}>{fieldItem.label}</th>
              <td><span className={styles.previewPlaceholder}>{previewPlaceholder(fieldItem.inputKind)}</span></td>
            </tr>
          )) : (
            <tr>
              {mainFields.map((fieldItem) => (
                <td key={fieldItem.id}><span className={styles.previewPlaceholder}>{previewPlaceholder(fieldItem.inputKind)}</span></td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function previewPlaceholder(inputKind: TeachingLearningTableConfig["fields"][number]["inputKind"]): string {
  switch (inputKind) {
    case "achievement_standards": return "성취기준 선택";
    case "bullet_list": return "· 항목 입력";
    case "checkbox_list": return "선택 항목";
    case "number": return "0";
    case "percentage": return "0%";
    case "multiline": return "여러 줄 입력";
    default: return "입력";
  }
}
