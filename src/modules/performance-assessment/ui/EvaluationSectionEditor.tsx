"use client";

import {
  listScoringModelDefinitions,
  parseScoringModelType,
  type EvaluationSection,
  type ScoringModel,
  type ScoringModelType,
} from "@/modules/performance-assessment";
import { createInitialScoringModel } from "./create-initial-scoring-model";
import { ScoringModelEditor } from "./ScoringModelEditor";
import { numberFromInput } from "./editors/shared";

const structuredDefinitions = listScoringModelDefinitions().filter(
  (definition) => definition.type !== "custom_table",
);

type EditableScoringModelType = Exclude<ScoringModelType, "custom_table">;

type Props = {
  section: EvaluationSection;
  index: number;
  onChange: (section: EvaluationSection) => void;
  onDelete: () => void;
  createId: () => string;
};

export function EvaluationSectionEditor({ section, index, onChange, onDelete, createId }: Props) {
  function changeModelType(type: EditableScoringModelType): void {
    onChange({
      ...section,
      scoringModel: createInitialScoringModel(type, section.maxScore, createId),
    });
  }

  function handleModelTypeChange(value: string): void {
    const type = parseScoringModelType(value);
    if (type === null || type === "custom_table") {
      return;
    }
    changeModelType(type);
  }

  return (
    <section className="assessment-section">
      <div className="section-editor-header">
        <h3>평가영역 {index + 1}</h3>
        <button type="button" className="text-button danger-text" onClick={onDelete}>
          영역 삭제
        </button>
      </div>

      <div className="form-grid three-columns">
        <label className="field">
          <span>영역명</span>
          <input value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
        </label>
        <label className="field">
          <span>영역 배점</span>
          <input
            type="number"
            min={0}
            value={section.maxScore}
            onChange={(event) => onChange({ ...section, maxScore: numberFromInput(event) })}
          />
        </label>
        <label className="field">
          <span>평가기준 방식</span>
          <select value={section.scoringModel.type} onChange={(event) => handleModelTypeChange(event.target.value)}>
            {structuredDefinitions.map((definition) => (
              <option key={definition.type} value={definition.type}>{definition.label}</option>
            ))}
          </select>
        </label>
      </div>

      <ScoringModelEditor
        model={section.scoringModel}
        onChange={(scoringModel: ScoringModel) => onChange({ ...section, scoringModel })}
        createId={createId}
      />
    </section>
  );
}
