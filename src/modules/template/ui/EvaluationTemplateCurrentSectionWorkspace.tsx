"use client";

import { useEffect, useState } from "react";

import { authenticatedFetch } from "@/shared/firebase/authenticated-fetch";
import type { EvaluationTemplate, EvaluationTemplateSection } from "../domain/evaluation-template";
import { getTeacherSectionTitlePresentation } from "../domain/evaluation-template-section-title";

type TemplateApiResponse = {
  template: EvaluationTemplate | null;
};

type EvaluationTemplateCurrentSectionWorkspaceProps = {
  sectionId: string;
};

export function EvaluationTemplateCurrentSectionWorkspace({
  sectionId,
}: EvaluationTemplateCurrentSectionWorkspaceProps) {
  const [section, setSection] = useState<EvaluationTemplateSection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSection() {
      try {
        const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections");
        if (!response.ok) throw new Error("평가계획 양식을 불러오지 못했습니다.");

        const body = (await response.json()) as TemplateApiResponse;
        const selected = body.template?.sections.find((item) => item.id === sectionId) ?? null;
        if (cancelled) return;

        if (!selected) {
          setError("선택한 양식 항목을 찾을 수 없습니다.");
          setSection(null);
        } else {
          setSection(selected);
          setError(null);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "평가계획 양식을 불러오지 못했습니다.");
        setSection(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSection();
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  if (isLoading) {
    return <p className="muted">양식 항목을 불러오는 중입니다.</p>;
  }

  if (error || !section) {
    return <p className="validation-error-box">{error ?? "선택한 양식 항목을 찾을 수 없습니다."}</p>;
  }

  const titlePresentation = getTeacherSectionTitlePresentation(section);

  return (
    <section className="panel">
      <h1 className="page-title">{section.title}</h1>
      <p className="page-intro muted">
        현재 양식에서 선택한 항목입니다. 이 항목의 실제 세부 편집 방식은 다음 단계에서 구성합니다.
      </p>
      <p className="small-copy muted">
        제목 설정: {titlePresentation.editable ? "교과에서 제목 설정 가능" : "평가계 제목 고정"}
      </p>
    </section>
  );
}
