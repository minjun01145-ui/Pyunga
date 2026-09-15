"use client";

import {
  createDefaultScoringModel,
  listScoringModelDefinitions,
  type PerformanceAssessment,
  type ScoringModelType,
} from "@/modules/performance-assessment";
import { ScoringModelEditor } from "./ScoringModelEditor";

const structuredDefinitions = listScoringModelDefinitions().filter(
  (definition) => definition.type !== "custom_table",
);

type Props = {
  assessment: PerformanceAssessment;
  onChange: (assessment: PerformanceAssessment) => void;
  createId: () => string;
};

export function WholeScoringEditor({ assessment, onChange, createId }: Props) {
  const model = assessment.wholeAssessmentScoringModel;

  function changeModelType(type: ScoringModelType): void {
    if (type === "custom_table") {
      return;
    }

    onChange({
      ...assessment,
      wholeAssessmentScoringModel: createDefaultScoringModel(type, assessment.maxScore, createId),
    });
  }

  return (
    <div className="whole-editor">
      <label className="field model-select-field">
        <span>평가기준 방식</span>
        <select value={model?.type ?? "threshold_table"} onChange={(event) => changeModelType(event.target.value as ScoringModelType)}>
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
