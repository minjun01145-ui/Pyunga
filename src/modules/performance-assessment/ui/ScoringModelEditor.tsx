"use client";

import type { ScoringModel } from "../domain/scoring-model";
import { AdditiveRubricEditor } from "./editors/AdditiveRubricEditor";
import { CriterionCountEditor } from "./editors/CriterionCountEditor";
import { LevelTableEditor } from "./editors/LevelTableEditor";
import { ThresholdTableEditor } from "./editors/ThresholdTableEditor";

type Props = {
  model: ScoringModel;
  onChange: (model: ScoringModel) => void;
  createId: () => string;
};

export function ScoringModelEditor({ model, onChange, createId }: Props) {
  switch (model.type) {
    case "level_table":
      return <LevelTableEditor model={model} onChange={onChange} createId={createId} />;
    case "threshold_table":
      return <ThresholdTableEditor model={model} onChange={onChange} createId={createId} />;
    case "criterion_count":
      return <CriterionCountEditor model={model} onChange={onChange} createId={createId} />;
    case "additive_rubric":
      return <AdditiveRubricEditor model={model} onChange={onChange} createId={createId} />;
    case "custom_table":
      return (
        <div className="notice">
          사용자 정의 표 편집기는 후속 단계에서 구현합니다. 현재 구조에는 타입만 보존되어 있습니다.
        </div>
      );
  }
}
