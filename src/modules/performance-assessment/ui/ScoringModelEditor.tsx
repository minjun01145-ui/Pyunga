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
      return <div className="notice">사용자 정의 표는 현재 지원하지 않습니다.</div>;
  }
}
