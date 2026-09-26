"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/modules/auth/client";
import { buildRawEvaluationPlanDocument } from "@/modules/document-export";
import { createEmptyEvaluationPlanDraft } from "@/modules/evaluation-plan";
import { useUnsavedChangesGuard } from "@/shared/ui/useUnsavedChangesGuard";
import { createDefaultEvaluationTemplate } from "../domain/default-evaluation-template";
import {
  moveEvaluationTemplateSection,
  updateEvaluationTemplateSection,
  type EvaluationTemplate,
  type EvaluationTemplateSectionPatch,
} from "../domain/evaluation-template";
import { EVALUATION_DOCUMENT_STYLES, resolveEvaluationTemplatePresentation } from "../domain/evaluation-template-presentation";
import { readSchoolLogo } from "../infrastructure/school-logo-image";
import type { EvaluationTemplateImportResult } from "../application/evaluation-template-import";
import type { EvaluationTemplateSource } from "../domain/evaluation-template";
import { EvaluationTemplateImportPanel } from "./EvaluationTemplateImportPanel";
import { EvaluationTemplateSectionEditor } from "./EvaluationTemplateSectionEditor";
import { EvaluationTemplateSectionInspector } from "./EvaluationTemplateSectionInspector";
import { InteractiveTemplatePreview } from "./InteractiveTemplatePreview";
import styles from "./EvaluationTemplatePresentationWorkspace.module.css";

type ImportApiResponse = Omit<EvaluationTemplateImportResult, "source"> & {
  source: EvaluationTemplateSource;
};

export function EvaluationTemplatePresentationWorkspace() {
  const [template, setTemplate] = useState<EvaluationTemplate>(createDefaultEvaluationTemplate);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useUnsavedChangesGuard(dirty, "저장하지 않은 학교 양식 설정이 있습니다. 이동하시겠습니까?");

  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1_000);
    return () => window.clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "양식을 불러오지 못했습니다.");
        if (!cancelled) {
          setTemplate(body.template ?? createDefaultEvaluationTemplate());
          setRevision(body.revision);
        }
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "양식을 불러오지 못했습니다.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function update(change: (current: EvaluationTemplate) => EvaluationTemplate) {
    setTemplate(change);
    setDirty(true);
    setMessage("");
    setError("");
  }

  function updateSection(sectionId: string, patch: EvaluationTemplateSectionPatch) {
    update((current) => ({
      ...current,
      sections: updateEvaluationTemplateSection(current.sections, sectionId, patch),
    }));
  }

  function moveSection(sectionId: string, direction: -1 | 1) {
    update((current) => {
      const index = current.sections.findIndex((section) => section.id === sectionId);
      return {
        ...current,
        sections: moveEvaluationTemplateSection(current.sections, index, direction),
      };
    });
  }

  async function save() {
    if (!template.academicPeriod) {
      setError("작성 학년도와 학기를 선택해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, expectedRevision: revision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "설정을 저장하지 못했습니다.");
      setRevision(body.revision);
      setDirty(false);
      setSelectedSectionId(null);
      setMessage("학교 양식을 저장했습니다. 교과 미리보기와 인쇄에 적용됩니다.");
      window.dispatchEvent(new Event("evaluation-template-saved"));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "설정을 저장하지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function importTemplate(file: File) {
    setBusy(true);
    setElapsedSeconds(0);
    setError("");
    setMessage("");
    setImportWarnings([]);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections/import", {
        method: "POST",
        body: formData,
      });
      const body = await response.json() as ImportApiResponse | { error?: string };
      if (!response.ok || !("sections" in body)) {
        throw new Error("error" in body && body.error ? body.error : "평가계획 분석에 실패했습니다.");
      }
      update((current) => ({
        ...current,
        documentTitle: body.documentTitle,
        sections: body.sections,
        source: body.source,
      }));
      setImportWarnings(body.warnings);
      setSelectedSectionId(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "평가계획 분석에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function applySectionEditorChange(nextTemplate: EvaluationTemplate) {
    update(() => nextTemplate);
  }

  const presentation = resolveEvaluationTemplatePresentation(template.presentation);
  const draft = createEmptyEvaluationPlanDraft();
  if (template.academicPeriod) {
    draft.academicYear = String(template.academicPeriod.academicYear);
    draft.semester = template.academicPeriod.semester === 1 ? "1" : "2";
  }
  const view = buildRawEvaluationPlanDocument(template, draft);
  const activeSectionId = template.sections.some((section) => section.id === selectedSectionId)
    ? selectedSectionId
    : null;

  return <div className="workspace-stack">
    <section className={`panel ${styles.controls}`}>
      <h1 className="page-title">학교 기본 양식</h1>
      <p className="muted">교과 입력 내용과 표 구조를 유지하면서 출력 모양을 선택합니다.</p>
      <fieldset disabled={busy} className={styles.fields}>
        <legend>학교 및 문서 정보</legend>
        <label className="field"><span>학교명</span><input maxLength={80} value={presentation.schoolName}
          onChange={(event) => update((current) => ({ ...current, presentation: { ...resolveEvaluationTemplatePresentation(current.presentation), schoolName: event.target.value } }))} /></label>
        <label className="field"><span>문서 제목</span><input maxLength={200} value={template.documentTitle ?? ""}
          onChange={(event) => update((current) => ({ ...current, documentTitle: event.target.value }))} />
          <small className="muted small-copy">교과명은 담당 교사의 교과 정보에 따라 제목 앞에 자동으로 표시됩니다.</small>
        </label>
        <label className="field"><span>작성 학년도</span><input type="number" min={2000} max={2100} value={template.academicPeriod?.academicYear ?? ""}
          onChange={(event) => update((current) => ({ ...current, academicPeriod: { academicYear: Number(event.target.value), semester: current.academicPeriod?.semester ?? 1 } }))} /></label>
        <label className="field"><span>작성 학기</span><select value={template.academicPeriod?.semester ?? ""}
          onChange={(event) => update((current) => ({ ...current, academicPeriod: { academicYear: current.academicPeriod?.academicYear ?? new Date().getFullYear(), semester: event.target.value === "2" ? 2 : 1 } }))}>
          <option value="" disabled>학기 선택</option><option value="1">1학기</option><option value="2">2학기</option></select></label>
        <label className="field"><span>학교 교표·로고 (5MB 이하)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const logoDataUrl = await readSchoolLogo(file);
            update((current) => ({ ...current, presentation: { ...resolveEvaluationTemplatePresentation(current.presentation), logoDataUrl } }));
          } catch (failure) { setError(failure instanceof Error ? failure.message : "교표를 읽지 못했습니다."); }
          finally { setBusy(false); }
        }} /></label>
        {presentation.logoDataUrl ? <button type="button" className="secondary-button" onClick={() => update((current) => {
          const next = resolveEvaluationTemplatePresentation(current.presentation);
          return { ...current, presentation: { style: next.style, schoolName: next.schoolName } };
        })}>교표 삭제</button> : null}
      </fieldset>
      {importWarnings.length > 0 ? (
        <div className="notice">
          <strong>PDF 분석 확인 사항</strong>
          <ul>{importWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </div>
      ) : null}
      <EvaluationTemplateImportPanel
        isLoading={busy}
        elapsedSeconds={elapsedSeconds}
        onImport={(file) => void importTemplate(file)}
      />
      <details className={styles.structureEditor}>
        <summary>항목 추가·삭제와 제목 계층 관리</summary>
        <EvaluationTemplateSectionEditor template={template} onChange={applySectionEditorChange} />
      </details>
      <fieldset disabled={busy} className={styles.presets}>
        <legend>기본 양식 선택</legend>
        {EVALUATION_DOCUMENT_STYLES.map((style) => <label key={style.id} className={styles.preset}>
          <span><input type="radio" name="document-style" checked={presentation.style === style.id} onChange={() => update((current) => ({ ...current, presentation: { ...resolveEvaluationTemplatePresentation(current.presentation), style: style.id } }))} /> {style.label}</span>
          <span className="muted small-copy">{style.description}</span>
        </label>)}
      </fieldset>
      <div className="save-actions">
        <button type="button" className="secondary-button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? "처리 중" : "학교 양식 저장"}</button>
        <button type="button" className="secondary-button" disabled={busy} onClick={() => {
          if (!window.confirm("현재 항목과 표 구조를 기본 구성으로 바꿉니다. 이전 양식의 교과 초안과 연결이 달라질 수 있습니다. 계속하시겠습니까?")) return;
          update((current) => ({ ...current, sections: createDefaultEvaluationTemplate().sections, source: undefined }));
        }}>항목을 기본 구성으로 복원</button>
        {dirty ? <p role="status" className={styles.unsavedStatus}>저장되지 않은 변경 사항이 있습니다.</p> : null}
      </div>
      {error ? <p role="alert" className="validation-error-box">{error}</p> : null}
      {message ? <p role="status" className="validation-success">{message}</p> : null}
    </section>
    <div className={styles.previewWorkspace}>
      <section className={styles.previewColumn} aria-label="학교 양식 미리보기">
        <div className={styles.previewLabel}>양식 미리보기 · 항목을 선택해 설정을 수정합니다.</div>
        <InteractiveTemplatePreview
          view={view}
          selectedSectionId={activeSectionId}
          onSelectSection={(sectionId) => {
            setError("");
            setMessage("");
            setSelectedSectionId((current) => current === sectionId ? null : sectionId);
          }}
          sectionInspector={
            <EvaluationTemplateSectionInspector
              sections={template.sections}
              selectedSectionId={activeSectionId}
              disabled={busy}
              error={error}
              onSave={() => void save()}
              onSectionChange={updateSection}
              onMoveSection={moveSection}
            />
          }
        />
      </section>
    </div>
  </div>;
}
