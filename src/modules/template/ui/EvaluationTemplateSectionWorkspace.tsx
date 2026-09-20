"use client";

import { useEffect, useMemo, useState } from "react";

import { authenticatedFetch } from "@/shared/firebase/authenticated-fetch";
import type { EvaluationTemplateImportResult } from "../application/evaluation-template-import";
import {
  getEvaluationTemplateIssues,
  type EvaluationTemplate,
  type EvaluationTemplateSource,
} from "../domain/evaluation-template";
import { EvaluationTemplateImportPanel } from "./EvaluationTemplateImportPanel";
import { EvaluationTemplateSectionEditor } from "./EvaluationTemplateSectionEditor";
import styles from "./EvaluationTemplateSectionWorkspace.module.css";

type ImportApiResponse = Omit<EvaluationTemplateImportResult, "source"> & {
  source: EvaluationTemplateSource;
};

type TemplateApiResponse = {
  template: EvaluationTemplate | null;
  revision: number;
};

type ApiErrorResponse = { error?: string };

export function EvaluationTemplateSectionWorkspace() {
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [revision, setRevision] = useState(0);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedTemplate() {
      try {
        const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections");
        if (!response.ok) return;
        const body = (await response.json()) as TemplateApiResponse;
        if (!cancelled) {
          setRevision(body.revision);
          if (body.template) setTemplate(body.template);
        }
      } catch {
        return;
      }
    }

    void loadSavedTemplate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const issues = useMemo(() => (template ? getEvaluationTemplateIssues(template) : []), [template]);

  async function handleImport(file: File) {
    setIsLoading(true);
    setElapsedSeconds(0);
    setError(null);
    setSaveMessage(null);
    setWarnings([]);

    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections/import", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as ImportApiResponse | ApiErrorResponse;
      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "평가계획 분석에 실패했습니다.");
      }

      const imported = body as ImportApiResponse;
      setTemplate({
        documentTitle: imported.documentTitle,
        sections: imported.sections,
        source: imported.source,
      });
      setWarnings(imported.warnings);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "평가계획 분석에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!template) return;
    if (issues.length > 0) {
      setError("항목 구조를 확인한 뒤 저장해 주세요.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: revision,
          template: {
            documentTitle: template.documentTitle,
            sections: template.sections.map((section) => ({
              id: section.id,
              title: section.title,
              level: section.level,
              teacherEditableTitle: section.teacherEditableTitle,
              sourcePage: section.sourcePage,
              config: section.config,
            })),
            source: template.source,
          },
        }),
      });
      const body = (await response.json()) as { savedCount?: number; revision?: number; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "평가계획 양식 저장에 실패했습니다.");
      }

      if (typeof body.revision === "number") setRevision(body.revision);
      setSaveMessage(`${body.savedCount ?? template.sections.length}개 공통 양식 항목을 저장했습니다.`);
      window.dispatchEvent(new Event("evaluation-template-saved"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "평가계획 양식 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleTemplateChange(nextTemplate: EvaluationTemplate) {
    setTemplate(nextTemplate);
    setSaveMessage(null);
  }

  return (
    <div className="workspace-stack">
      <EvaluationTemplateImportPanel
        isLoading={isLoading}
        elapsedSeconds={elapsedSeconds}
        onImport={(file) => void handleImport(file)}
      />

      {error ? <p className="validation-error-box">{error}</p> : null}

      {template ? (
        <section className="panel">
          <div className={styles.resultHeader}>
            <div>
              <h2 className="subsection-title">대분류 구조 수정</h2>
              <p className="muted small-copy">
                {template.documentTitle ?? template.source?.fileName ?? "평가계획 양식"}
                {template.source ? ` · 전체 ${template.source.totalPages}쪽 중 ${formatPages(template.source.selectedPages)}` : ""}
              </p>
            </div>
            <span className="small-copy">공통 양식 {template.sections.length}개 항목</span>
          </div>

          {warnings.length > 0 ? (
            <div className={`notice ${styles.warningBox}`}>
              <strong>확인 사항</strong>
              <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : null}

          <EvaluationTemplateSectionEditor
            template={template}
            onChange={handleTemplateChange}
          />

          {issues.length > 0 ? (
            <div className={`validation-error-box ${styles.issues}`}>
              <strong>저장 전 확인</strong>
              <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          ) : null}

          <div className="save-actions">
            <button className="secondary-button" type="button" disabled={isSaving} onClick={handleSave}>
              {isSaving ? "저장 중" : "저장"}
            </button>
            {saveMessage ? <p className="validation-success">{saveMessage}</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatPages(pages: readonly number[]): string {
  if (pages.length === 0) return "분석 페이지 없음";
  if (pages.length <= 8) return `분석 ${pages.join(", ")}쪽`;
  return `분석 ${pages[0]}~${pages[pages.length - 1]}쪽`;
}
