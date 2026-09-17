"use client";

import type { EvaluationTemplateRepeatableItemSample } from "../application/evaluation-template-import";
import type { EvaluationTemplateSection } from "../domain/evaluation-template";
import styles from "./EvaluationTemplateSectionWorkspace.module.css";

type EvaluationTemplateRepeatableSamplesProps = {
  samples: readonly EvaluationTemplateRepeatableItemSample[];
  sections: readonly EvaluationTemplateSection[];
};

export function EvaluationTemplateRepeatableSamples({
  samples,
  sections,
}: EvaluationTemplateRepeatableSamplesProps) {
  const repeatableParentIds = new Set(
    sections.filter((section) => section.childrenMode === "repeatable").map((section) => section.id),
  );
  const visibleSamples = samples.filter((sample) => repeatableParentIds.has(sample.parentSectionId));
  if (visibleSamples.length === 0) return null;

  const titleById = new Map(sections.map((section) => [section.id, section.title]));
  const grouped = groupSamplesByParent(visibleSamples);

  return (
    <section className={`notice ${styles.repeatableSamples}`}>
      <h3>교과별 항목으로 분리된 내용</h3>
      <p className="small-copy">
        아래 항목은 불러온 교과의 실제 평가명으로 판단되어 학교 공통 양식에는 저장하지 않습니다.
        각 교과의 평가계획 작성 화면에서 별도 데이터로 추가하게 됩니다.
      </p>
      <div className={styles.sampleGroups}>
        {grouped.map(([parentSectionId, parentSamples]) => (
          <div key={parentSectionId} className={styles.sampleGroup}>
            <strong>{titleById.get(parentSectionId) ?? "교과별 반복 항목"}</strong>
            <ul>
              {parentSamples.map((sample, index) => (
                <li key={`${sample.title}-${sample.sourcePage ?? 0}-${index}`}>
                  {sample.title}{sample.sourcePage ? ` · ${sample.sourcePage}쪽` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function groupSamplesByParent(
  samples: readonly EvaluationTemplateRepeatableItemSample[],
): Array<[string, EvaluationTemplateRepeatableItemSample[]]> {
  const grouped = new Map<string, EvaluationTemplateRepeatableItemSample[]>();
  for (const sample of samples) {
    const current = grouped.get(sample.parentSectionId) ?? [];
    current.push(sample);
    grouped.set(sample.parentSectionId, current);
  }
  return [...grouped.entries()];
}
