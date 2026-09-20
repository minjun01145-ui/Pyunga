"use client";

import { useEffect, useState } from "react";

import { authenticatedFetch } from "@/modules/auth/client";
import { useUnsavedChangesGuard } from "@/shared/ui/useUnsavedChangesGuard";
import type { EvaluationTemplate } from "../domain/evaluation-template";
import type { EvaluationTemplateSectionConfig } from "../domain/evaluation-template-section-config";
import { getTeacherSectionTitlePresentation } from "../domain/evaluation-template-section-title";
import { EvaluationTemplateSectionFormatEditor } from "./EvaluationTemplateSectionFormatEditor";
import styles from "./EvaluationTemplateCurrentSectionWorkspace.module.css";

type TemplateApiResponse = {
  template: EvaluationTemplate | null;
  revision: number;
};

type EvaluationTemplateCurrentSectionWorkspaceProps = {
  sectionId: string;
};

export function EvaluationTemplateCurrentSectionWorkspace({
  sectionId,
}: EvaluationTemplateCurrentSectionWorkspaceProps) {
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [revision, setRevision] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSection() {
      try {
        const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections");
        if (!response.ok) throw new Error("평가계획 양식을 불러오지 못했습니다.");

        const body = (await response.json()) as TemplateApiResponse;
        const selected = body.template?.sections.find((item) => item.id === sectionId) ?? null;
        if (cancelled) return;
        setRevision(body.revision);

        if (!selected || !body.template) {
          setError("선택한 양식 항목을 찾을 수 없습니다.");
          setTemplate(null);
        } else {
          setTemplate(body.template);
          setIsDirty(false);
          setError(null);
        }
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "평가계획 양식을 불러오지 못했습니다.");
        setTemplate(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSection();
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  useUnsavedChangesGuard(
    isDirty,
    "저장하지 않은 양식 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?",
  );

  if (isLoading) {
    return <p className="muted">양식 항목을 불러오는 중입니다.</p>;
  }

  const sectionIndex = template?.sections.findIndex((item) => item.id === sectionId) ?? -1;
  const section = sectionIndex >= 0 ? template?.sections[sectionIndex] : undefined;

  if (!template || !section) {
    return <p className="validation-error-box">{error ?? "선택한 양식 항목을 찾을 수 없습니다."}</p>;
  }

  const titlePresentation = getTeacherSectionTitlePresentation(section);

  function handleConfigChange(config: EvaluationTemplateSectionConfig) {
    setTemplate((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((item) => item.id === sectionId ? { ...item, config } : item),
      };
    });
    setIsDirty(true);
    setSaveMessage(null);
    setError(null);
  }

  async function handleSave() {
    if (!template) return;
    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, expectedRevision: revision }),
      });
      const body = (await response.json()) as { revision?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "양식 저장에 실패했습니다.");
      if (typeof body.revision === "number") setRevision(body.revision);
      setIsDirty(false);
      setSaveMessage("이 항목의 입력 양식을 저장했습니다.");
      window.dispatchEvent(new Event("evaluation-template-saved"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "양식 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.sectionWorkspace}>
      <section className="panel">
        <h1 className="page-title">{section.title}</h1>
        <p className={`small-copy muted ${styles.sectionMeta}`}>
          <span>제목 설정: {titlePresentation.editable ? "교과에서 제목 설정 가능" : "평가계 제목 고정"}</span>
          {section.sourcePage ? <span>원문: {section.sourcePage}쪽</span> : null}
          {template.source ? <span>불러온 파일: {template.source.fileName}</span> : null}
        </p>
      </section>

      <section className="panel">
        <EvaluationTemplateSectionFormatEditor
          key={section.id}
          config={section.config}
          onChange={handleConfigChange}
        />
        <div className="save-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={isSaving || !section.config || !isDirty}
            onClick={() => void handleSave()}
          >
            {isSaving ? "저장 중" : isDirty ? "양식 저장" : "저장됨"}
          </button>
          {saveMessage ? <p className="validation-success">{saveMessage}</p> : null}
        </div>
        {error ? <p className="validation-error-box">{error}</p> : null}
      </section>
    </div>
  );
}
