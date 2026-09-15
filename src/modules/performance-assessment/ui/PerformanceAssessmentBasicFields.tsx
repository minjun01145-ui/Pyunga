"use client";

import type { PerformanceAssessment } from "../domain/performance-assessment";
import { numberFromInput } from "./editors/shared";

type Props = {
  assessment: PerformanceAssessment;
  onChange: (assessment: PerformanceAssessment) => void;
};

export function PerformanceAssessmentBasicFields({ assessment, onChange }: Props) {
  return (
    <section className="panel">
      <h2 className="section-title first-section-title">기본정보</h2>
      <div className="form-grid three-columns">
        <label className="field">
          <span>수행평가명</span>
          <input
            value={assessment.title}
            onChange={(event) => onChange({ ...assessment, title: event.target.value })}
          />
        </label>
        <label className="field">
          <span>평가 반영비율 (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={assessment.weightPercent}
            onChange={(event) => onChange({ ...assessment, weightPercent: numberFromInput(event) })}
          />
        </label>
        <label className="field">
          <span>수행평가 총점</span>
          <input
            type="number"
            min={0}
            value={assessment.maxScore}
            onChange={(event) => onChange({ ...assessment, maxScore: numberFromInput(event) })}
          />
        </label>
      </div>
    </section>
  );
}
