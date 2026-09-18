"use client";

import type {
  TeachingLearningTableConfig,
  TeachingLearningTableField,
  TemplateFieldInputKind,
  TemplateFieldSource,
} from "../domain/evaluation-template-section-config";
import styles from "./EvaluationTemplateCurrentSectionWorkspace.module.css";

type TeachingLearningTableTemplateEditorProps = {
  config: TeachingLearningTableConfig;
  onChange: (config: TeachingLearningTableConfig) => void;
};

const inputKindLabels: Record<TemplateFieldInputKind, string> = {
  text: "한 줄 입력",
  multiline: "여러 줄 입력",
  number: "숫자",
  percentage: "비율(%)",
  achievement_standards: "성취기준 선택",
  bullet_list: "개조식 목록",
  checkbox_list: "복수 선택",
};

const sourceLabels: Record<TemplateFieldSource, string> = {
  system: "시스템",
  teacher: "교과 입력",
  custom: "학교 추가",
};

const inputKinds: TemplateFieldInputKind[] = [
  "text",
  "multiline",
  "number",
  "percentage",
  "achievement_standards",
  "bullet_list",
  "checkbox_list",
];
const sources: TemplateFieldSource[] = ["system", "teacher", "custom"];

export function TeachingLearningTableTemplateEditor({
  config,
  onChange,
}: TeachingLearningTableTemplateEditorProps) {
  function updateField(index: number, patch: Partial<TeachingLearningTableField>) {
    const fields = config.fields.map((fieldItem, fieldIndex) =>
      fieldIndex === index ? { ...fieldItem, ...patch } : fieldItem,
    );
    onChange({ ...config, fields });
  }

  function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= config.fields.length) return;
    const fields = [...config.fields];
    [fields[index], fields[target]] = [fields[target], fields[index]];
    onChange({ ...config, fields });
  }

  function removeField(index: number) {
    if (config.fields.length <= 1) return;
    onChange({ ...config, fields: config.fields.filter((_, fieldIndex) => fieldIndex !== index) });
  }

  function addField() {
    const suffix = createFieldSuffix();
    onChange({
      ...config,
      fields: [
        ...config.fields,
        {
          id: `custom-${suffix}`,
          fieldKey: `custom.${suffix}`,
          label: "새 입력 항목",
          inputKind: "multiline",
          source: "custom",
          placement: "main",
          widthWeight: 1,
        },
      ],
    });
  }

  return (
    <div className={styles.editorStack}>
      <div className={styles.tableOptions}>
        <label className="field">
          <span>페이지 방향</span>
          <select
            value={config.orientation}
            onChange={(event) =>
              onChange({ ...config, orientation: event.target.value === "portrait" ? "portrait" : "landscape" })
            }
          >
            <option value="landscape">가로</option>
            <option value="portrait">세로</option>
          </select>
        </label>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={config.repeatHeader}
            onChange={(event) => onChange({ ...config, repeatHeader: event.target.checked })}
          />
          <span>페이지가 넘어가면 표 머리글 반복</span>
        </label>
        <label className="field">
          <span>오른쪽 세로 영역 제목</span>
          <input
            value={config.detailHeaderLabel ?? ""}
            placeholder="예: 수업-평가 방법, 수업·평가 연계의 주안점"
            onChange={(event) =>
              onChange({ ...config, detailHeaderLabel: event.target.value.trimStart() || undefined })
            }
          />
        </label>
      </div>

      <div className={styles.fieldTableScroll}>
        <table className={`simple-table compact-table ${styles.fieldTable}`}>
          <thead>
            <tr>
              <th>표시명</th>
              <th>입력 방식</th>
              <th>입력 주체</th>
              <th>배치</th>
              <th>폭</th>
              <th>필수</th>
              <th aria-label="순서 및 삭제" />
            </tr>
          </thead>
          <tbody>
            {config.fields.map((fieldItem, index) => (
              <tr key={fieldItem.id}>
                <td>
                  <input
                    aria-label={`${index + 1}번째 표시명`}
                    value={fieldItem.label}
                    onChange={(event) => updateField(index, { label: event.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label={`${fieldItem.label} 입력 방식`}
                    value={fieldItem.inputKind}
                    onChange={(event) => updateField(index, { inputKind: parseInputKind(event.target.value) })}
                  >
                    {inputKinds.map((kind) => <option key={kind} value={kind}>{inputKindLabels[kind]}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    aria-label={`${fieldItem.label} 입력 주체`}
                    value={fieldItem.source}
                    onChange={(event) => updateField(index, { source: parseSource(event.target.value) })}
                  >
                    {sources.map((source) => <option key={source} value={source}>{sourceLabels[source]}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    aria-label={`${fieldItem.label} 배치`}
                    value={fieldItem.placement}
                    onChange={(event) =>
                      updateField(index, { placement: event.target.value === "detail" ? "detail" : "main" })
                    }
                  >
                    <option value="main">기본 열</option>
                    <option value="detail">오른쪽 세로 영역</option>
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`${fieldItem.label} 폭`}
                    type="number"
                    min="0.2"
                    max="20"
                    step="0.1"
                    value={fieldItem.widthWeight ?? 1}
                    onChange={(event) => updateField(index, { widthWeight: parseWidth(event.target.value) })}
                  />
                </td>
                <td className={styles.centerCell}>
                  <input
                    aria-label={`${fieldItem.label} 필수 입력`}
                    type="checkbox"
                    checked={fieldItem.required ?? false}
                    onChange={(event) => updateField(index, { required: event.target.checked })}
                  />
                </td>
                <td className={styles.fieldActions}>
                  <button className="text-button" type="button" disabled={index === 0} onClick={() => moveField(index, -1)}>위</button>
                  <button className="text-button" type="button" disabled={index === config.fields.length - 1} onClick={() => moveField(index, 1)}>아래</button>
                  <button className="text-button danger-text" type="button" disabled={config.fields.length <= 1} onClick={() => removeField(index)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="secondary-button align-start" type="button" onClick={addField}>입력 항목 추가</button>
    </div>
  );
}

function parseInputKind(value: string): TemplateFieldInputKind {
  switch (value) {
    case "multiline": return "multiline";
    case "number": return "number";
    case "percentage": return "percentage";
    case "achievement_standards": return "achievement_standards";
    case "bullet_list": return "bullet_list";
    case "checkbox_list": return "checkbox_list";
    default: return "text";
  }
}

function parseSource(value: string): TemplateFieldSource {
  if (value === "system") return "system";
  if (value === "custom") return "custom";
  return "teacher";
}

function parseWidth(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 1;
}

function createFieldSuffix(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
