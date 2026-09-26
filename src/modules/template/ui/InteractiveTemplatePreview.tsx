"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import type { RawEvaluationPlanDocumentView } from "@/modules/document-export";
import { RawEvaluationPlanDocument } from "@/modules/document-export";
import styles from "./InteractiveTemplatePreview.module.css";

type InteractiveTemplatePreviewProps = {
  view: RawEvaluationPlanDocumentView;
  selectedSectionId: string | null;
  onSelectSection: (sectionId: string) => void;
  sectionInspector?: ReactNode;
};

type SectionRegion = {
  id: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

export function InteractiveTemplatePreview({
  view,
  selectedSectionId,
  onSelectSection,
  sectionInspector,
}: InteractiveTemplatePreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [regions, setRegions] = useState<SectionRegion[]>([]);
  const titleById = new Map(view.sections.map((section) => [section.id, section.title]));

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const currentPreview = preview;

    function measureSections() {
      const previewBounds = currentPreview.getBoundingClientRect();
      const nextRegions = [...currentPreview.querySelectorAll<HTMLElement>("[data-template-section-id]")]
        .flatMap((element) => {
          const id = element.getAttribute("data-template-section-id");
          const bounds = element.getBoundingClientRect();
          if (!id || bounds.width <= 0 || bounds.height <= 0) return [];
          return [{
            id,
            top: bounds.top - previewBounds.top,
            left: bounds.left - previewBounds.left,
            width: bounds.width,
            height: bounds.height,
          }];
        });
      setRegions(nextRegions);
    }

    measureSections();
    window.addEventListener("resize", measureSections);

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(measureSections);
    resizeObserver?.observe(currentPreview);
    currentPreview.querySelectorAll<HTMLElement>("[data-template-section-id]")
      .forEach((element) => resizeObserver?.observe(element));

    return () => {
      window.removeEventListener("resize", measureSections);
      resizeObserver?.disconnect();
    };
  }, [view]);

  return (
    <div className={styles.preview} ref={previewRef}>
      <RawEvaluationPlanDocument
        view={view}
        afterSection={sectionInspector && selectedSectionId
          ? (section) => section.id === selectedSectionId
            ? <div className={styles.inlineInspector}>{sectionInspector}</div>
            : null
          : undefined}
      />
      <div className={styles.selectionLayer} role="group" aria-label="문서 항목 선택">
        {regions.map((region) => {
          const selected = selectedSectionId === region.id;
          const title = titleById.get(region.id)?.trim() || "제목 없는 항목";
          return (
            <button
              key={region.id}
              className={`${styles.selectionButton} ${selected ? styles.selected : ""}`}
              type="button"
              aria-label={`미리보기에서 ${title} 선택`}
              aria-pressed={selected}
              title={title}
              style={{
                top: region.top,
                left: region.left,
                width: region.width,
                height: region.height,
              }}
              onClick={() => onSelectSection(region.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
