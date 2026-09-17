"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { authenticatedFetch } from "@/shared/firebase/authenticated-fetch";
import styles from "./EvaluationTemplateSectionWorkspace.module.css";
import {
  canMoveEvaluationTemplateSection,
  getEvaluationTemplateIssues,
  moveEvaluationTemplateSection,
  normalizeEvaluationTemplateSections,
  removeEvaluationTemplateSection,
  type EvaluationTemplate,
  type EvaluationTemplateSection,
  type EvaluationTemplateSectionInput,
  type EvaluationTemplateSectionLevel,
  type EvaluationTemplateSource,
} from "../domain/evaluation-template";

type ImportApiResponse = {
  documentTitle?: string;
  sections: EvaluationTemplateSection[];
  warnings: string[];
  source: EvaluationTemplateSource;
};

type TemplateApiResponse = {
  template: EvaluationTemplate | null;
};

type ApiErrorResponse = { error?: string };

const levelLabels: Record<EvaluationTemplateSectionLevel, string> = {
  1: "대분류",
  2: "중분류",
  3: "소분류",
};

const levels: EvaluationTemplateSectionLevel[] = [1, 2, 3];

export function EvaluationTemplateSectionWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
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
        if (!cancelled && body.template) {
          setTemplate(body.template);
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
  const titleById = useMemo(
    () => new Map(template?.sections.map((section) => [section.id, section.title]) ?? []),
    [template?.sections],
  );

  async function handleImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("불러올 평가계획 PDF를 선택해 주세요.");
      return;
    }

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
          documentTitle: template.documentTitle,
          sections: template.sections.map((section) => ({
            id: section.id,
            title: section.title,
            level: section.level,
            sourcePage: section.sourcePage,
          })),
          source: template.source,
        }),
      });
      const body = (await response.json()) as { savedCount?: number; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "평가계획 양식 저장에 실패했습니다.");
      }

      setSaveMessage(`${body.savedCount ?? template.sections.length}개 항목을 저장했습니다.`);
      window.dispatchEvent(new Event("evaluation-template-saved"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "평가계획 양식 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateSection(index: number, patch: Partial<EvaluationTemplateSectionInput>) {
    setTemplate((current) => {
      if (!current) return current;
      const inputs = current.sections.map(toSectionInput);
      inputs[index] = { ...inputs[index], ...patch };
      return { ...current, sections: normalizeEvaluationTemplateSections(inputs) };
    });
    setSaveMessage(null);
  }

  function moveSection(index: number, direction: -1 | 1) {
    setTemplate((current) =>
      current ? { ...current, sections: moveEvaluationTemplateSection(current.sections, index, direction) } : current,
    );
    setSaveMessage(null);
  }

  function removeSection(index: number) {
    setTemplate((current) =>
      current ? { ...current, sections: removeEvaluationTemplateSection(current.sections, index) } : current,
    );
    setSaveMessage(null);
  }

  function addSection() {
    setTemplate((current) => {
      const nextInput: EvaluationTemplateSectionInput = {
        id: createSectionId(),
        title: "새 항목",
        level: 1,
      };
      if (!current) {
        return { sections: normalizeEvaluationTemplateSections([nextInput]) };
      }
      return {
        ...current,
        sections: normalizeEvaluationTemplateSections([...current.sections.map(toSectionInput), nextInput]),
      };
    });
    setSaveMessage(null);
  }

  return (
    <div className="workspace-stack">
      <section className="panel">
        <h2 className="subsection-title">전년도 평가계획 불러오기</h2>
        <p className="muted small-copy">
          전년도 평가계획 PDF에서 문서의 제목 구조를 찾아 대분류·중분류·소분류 초안을 만듭니다. 불러온 뒤 제목과 단계, 순서를 확인하고 저장합니다.
        </p>
        <form className={styles.importForm} onSubmit={handleImport}>
          <label className="field">
            <span>평가계획 PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(changeEvent) => setFile(changeEvent.target.files?.[0] ?? null)}
            />
          </label>
          <button className="secondary-button align-start" type="submit" disabled={isLoading}>
            {isLoading ? `불러오는 중 · ${elapsedSeconds}초` : "평가계획 불러오기"}
          </button>
        </form>
        <p className={`muted small-copy ${styles.importNote}`}>
          {isLoading
            ? "문서 분량에 따라 분석에 시간이 걸릴 수 있습니다. 완료될 때까지 이 화면을 닫지 마세요."
            : "PDF에서 읽은 문서 구조는 초안으로만 사용되며 저장 전 직접 수정할 수 있습니다."}
        </p>
        {error ? <p className="validation-error-box">{error}</p> : null}
      </section>

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
            <span className="small-copy">총 {template.sections.length}개 항목</span>
          </div>

          {warnings.length > 0 ? (
            <div className={`notice ${styles.warningBox}`}>
              <strong>확인 사항</strong>
              <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          ) : null}

          <div className={styles.sectionList}>
            {template.sections.map((section, index) => (
              <div
                className={`${styles.sectionRow} ${styles[`level${section.level}`]}`}
                key={section.id}
              >
                <label className={`field ${styles.levelField}`}>
                  <span>단계</span>
                  <select
                    value={section.level}
                    onChange={(changeEvent) =>
                      updateSection(index, { level: parseSectionLevel(changeEvent.target.value) })
                    }
                  >
                    {levels.map((level) => (
                      <option key={level} value={level}>{levelLabels[level]}</option>
                    ))}
                  </select>
                </label>

                <label className={`field ${styles.titleField}`}>
                  <span>제목</span>
                  <input
                    maxLength={120}
                    value={section.title}
                    onChange={(changeEvent) => updateSection(index, { title: changeEvent.target.value })}
                  />
                </label>

                <div className={styles.metaField}>
                  <span>상위 항목</span>
                  <strong>{section.parentId ? titleById.get(section.parentId) ?? "-" : "-"}</strong>
                </div>

                <div className={styles.metaField}>
                  <span>원문</span>
                  <strong>{section.sourcePage ? `${section.sourcePage}쪽` : "-"}</strong>
                </div>

                <div className={styles.rowActions} aria-label={`${section.title} 순서 및 삭제`}>
                  <button
                    className="text-button"
                    type="button"
                    disabled={!canMoveEvaluationTemplateSection(template.sections, index, -1)}
                    onClick={() => moveSection(index, -1)}
                  >
                    위
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={!canMoveEvaluationTemplateSection(template.sections, index, 1)}
                    onClick={() => moveSection(index, 1)}
                  >
                    아래
                  </button>
                  <button className="text-button danger-text" type="button" onClick={() => removeSection(index)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button className="secondary-button" type="button" onClick={addSection}>항목 추가</button>

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

function toSectionInput(section: EvaluationTemplateSection): EvaluationTemplateSectionInput {
  return {
    id: section.id,
    title: section.title,
    level: section.level,
    ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
  };
}

function parseSectionLevel(value: string): EvaluationTemplateSectionLevel {
  if (value === "2") return 2;
  if (value === "3") return 3;
  return 1;
}

function createSectionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `section-${crypto.randomUUID()}`
    : `section-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatPages(pages: readonly number[]): string {
  if (pages.length === 0) return "분석 페이지 없음";
  if (pages.length <= 8) return `분석 ${pages.join(", ")}쪽`;
  return `분석 ${pages[0]}~${pages[pages.length - 1]}쪽`;
}
