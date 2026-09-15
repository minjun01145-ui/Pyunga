"use client";

import {
  listScoringModelDefinitions,
  parseScoringModelType,
  type PerformanceAssessment,
  type ScoringModelType,
} from "@/modules/performance-assessment";
import { createInitialScoringModel } from "./create-initial-scoring-model";
import { ScoringModelEditor } from "./ScoringModelEditor";

const structuredDefinitions = listScoringModelDefinitions().filter(
  (definition) => definition.type !== "custom_table",
);

type EditableScoringModelType = Exclude<ScoringModelType, "custom_table">;

type Props = {
  assessment: PerformanceAssessment;
  onChange: (assessment: PerformanceAssessment) => void;
  createId: () => string;
};

export function WholeScoringEditor({ assessment, onChange, createId }: Props) {
  const model = assessment.wholeAssessmentScoringModel;

  function changeModelType(type: EditableScoringModelType): void {
    onChange({
      ...assessment,
      wholeAssessmentScoringModel: createInitialScoringModel(type, assessment.maxScore, createId),
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
    <div className="whole-editor">
      <label className="field model-select-field">
        <span>평가기준 방식</span>
        <select
          value={model?.type ?? "threshold_table"}
          onChange={(event) => handleModelTypeChange(event.target.value)}
        >
          {structuredDefinitions.map((definition) => (
            <option key={definition.type} value={definition.type}>{definition.label}</option>
          ))}
        </select>
      </label>

      {model ? (
        <ScoringModelEditor
          model={model}
          onChange={(wholeAssessmentScoringModel) => onChange({ ...assessment, wholeAssessmentScoringModel })}
          createId={createId}
        />
      ) : null}
    </div>
  );
}
