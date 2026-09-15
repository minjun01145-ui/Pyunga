"use client";

import { useMemo, useState } from "react";
import {
  type PerformanceAssessment,
  validatePerformanceAssessment,
} from "@/modules/performance-assessment";
import { createInitialScoringModel } from "./create-initial-scoring-model";
import { PerformanceAssessmentBasicFields } from "./PerformanceAssessmentBasicFields";
import { PerformanceValidationPanel } from "./PerformanceValidationPanel";
import { SectionedScoringEditor } from "./SectionedScoringEditor";
import { WholeScoringEditor } from "./WholeScoringEditor";
import { createPrototypeAssessment } from "./prototype/create-prototype-assessment";

type ScoringMode = "sections" | "whole";

function createId(): string {
  return crypto.randomUUID();
}

export function PerformanceAssessmentEditor() {
  const [assessment, setAssessment] = useState<PerformanceAssessment>(createPrototypeAssessment);
  const [showRawData, setShowRawData] = useState(false);

  const scoringMode: ScoringMode = assessment.sections.length > 0 ? "sections" : "whole";
  const validationErrors = useMemo(() => validatePerformanceAssessment(assessment), [assessment]);

  function changeMode(mode: ScoringMode): void {
    if (mode === scoringMode) {
      return;
    }

    if (mode === "sections") {
      setAssessment((current) => ({
        ...current,
        wholeAssessmentScoringModel: undefined,
        sections: [
          {
            id: createId(),
            title: "평가영역 1",
            maxScore: current.maxScore,
            scoringModel: createInitialScoringModel("level_table", current.maxScore, createId),
          },
        ],
      }));
      return;
    }

    setAssessment((current) => ({
      ...current,
      sections: [],
      wholeAssessmentScoringModel: createInitialScoringModel("threshold_table", current.maxScore, createId),
    }));
  }

  return (
    <div className="workspace-stack">
      <PerformanceAssessmentBasicFields assessment={assessment} onChange={setAssessment} />

      <section className="panel">
        <h2 className="section-title first-section-title">세부 평가기준 구성</h2>
        <p className="muted small-copy">
          영역별로 나누어 평가하거나, 수행평가 전체를 하나의 기준표로 평가할 수 있습니다. 방식 변경 시 기존 세부기준은 초기화됩니다.
        </p>
        <div className="segmented-control" role="group" aria-label="평가기준 구성 방식">
          <button
            type="button"
            className={scoringMode === "sections" ? "segment active" : "segment"}
            onClick={() => changeMode("sections")}
          >
            영역별 평가
          </button>
          <button
            type="button"
            className={scoringMode === "whole" ? "segment active" : "segment"}
            onClick={() => changeMode("whole")}
          >
            전체 단일기준
          </button>
        </div>

        {scoringMode === "sections" ? (
          <SectionedScoringEditor assessment={assessment} onChange={setAssessment} createId={createId} />
        ) : (
          <WholeScoringEditor assessment={assessment} onChange={setAssessment} createId={createId} />
        )}
      </section>

      <PerformanceValidationPanel
        assessment={assessment}
        errors={validationErrors}
        showRawData={showRawData}
        onToggleRawData={() => setShowRawData((current) => !current)}
      />
    </div>
  );
}
