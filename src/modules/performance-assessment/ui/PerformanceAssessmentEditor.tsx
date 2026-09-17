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
import { authenticatedFetch } from "@/shared/firebase/authenticated-fetch";

type ScoringMode = "sections" | "whole";

function createId(): string {
  return crypto.randomUUID();
}

export function PerformanceAssessmentEditor() {
  const [assessment, setAssessment] = useState<PerformanceAssessment>(createPrototypeAssessment);
  const [showRawData, setShowRawData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

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

  async function saveDraft(): Promise<void> {
    if (validationErrors.length > 0) {
      setSaveMessage("검증 오류를 먼저 확인해 주세요.");
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const response = await authenticatedFetch(
        `/api/teacher/performance-assessment-drafts/${encodeURIComponent(assessment.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assessment),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "초안 저장에 실패했습니다.");
      setSaveMessage("수행평가 초안을 저장했습니다.");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "초안 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
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
      <section className="panel save-actions">
        <button className="secondary-button" type="button" disabled={isSaving} onClick={saveDraft}>
          {isSaving ? "저장 중" : "초안 저장"}
        </button>
        {saveMessage ? <p className="small-copy">{saveMessage}</p> : null}
      </section>
    </div>
  );
}
