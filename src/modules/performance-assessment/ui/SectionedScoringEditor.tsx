"use client";

import { createDefaultScoringModel, type PerformanceAssessment } from "@/modules/performance-assessment";
import { EvaluationSectionEditor } from "./EvaluationSectionEditor";

type Props = {
  assessment: PerformanceAssessment;
  onChange: (assessment: PerformanceAssessment) => void;
  createId: () => string;
};

export function SectionedScoringEditor({ assessment, onChange, createId }: Props) {
  return (
    <div className="stack-list section-editor-list">
      {assessment.sections.map((section, index) => (
        <EvaluationSectionEditor
          key={section.id}
          section={section}
          index={index}
          createId={createId}
          onChange={(updatedSection) => onChange({
            ...assessment,
            sections: assessment.sections.map((candidate) =>
              candidate.id === section.id ? updatedSection : candidate,
            ),
          })}
          onDelete={() => onChange({
            ...assessment,
            sections: assessment.sections.filter((candidate) => candidate.id !== section.id),
          })}
        />
      ))}

      <button
        type="button"
        className="secondary-button align-start"
        onClick={() => onChange({
          ...assessment,
          sections: [
            ...assessment.sections,
            {
              id: createId(),
              title: `평가영역 ${assessment.sections.length + 1}`,
              maxScore: 0,
              scoringModel: createDefaultScoringModel("level_table", 0, createId),
            },
          ],
        })}
      >
        평가영역 추가
      </button>
    </div>
  );
}
