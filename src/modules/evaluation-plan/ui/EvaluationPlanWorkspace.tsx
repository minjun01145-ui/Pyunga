"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanDraftTemplateIssues,
  getEvaluationPlanTemplateSignature,
  type EvaluationPlanDraft,
  type EvaluationPlanDraftFieldValue,
  type EvaluationPlanDraftSection,
} from "@/modules/evaluation-plan";
import type { EvaluationTemplate, EvaluationTemplateSection } from "@/modules/template";
import { authenticatedFetch } from "@/shared/firebase/authenticated-fetch";
import { useUnsavedChangesGuard } from "@/shared/ui/useUnsavedChangesGuard";
import {
  loadEvaluationPlanDraftFromStorage,
  resetInvalidEvaluationPlanDraftStorage,
  saveEvaluationPlanDraftToStorage,
} from "../infrastructure/browser-evaluation-plan-draft";

import { EvaluationPlanTemplateTable } from "./EvaluationPlanTemplateTable";
import styles from "./EvaluationPlanWorkspace.module.css";

type WorkspaceApiResponse = {
  template: EvaluationTemplate | null;
  error?: string;
};

export function EvaluationPlanWorkspace() {
  const router = useRouter();
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [draft, setDraft] = useState<EvaluationPlanDraft>(createEmptyEvaluationPlanDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [hasInvalidStorage, setHasInvalidStorage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const response = await authenticatedFetch("/api/teacher/evaluation-plan");
        const body = (await response.json()) as WorkspaceApiResponse;
        if (!response.ok) throw new Error(body.error ?? "평가계획 작성 자료를 불러오지 못했습니다.");
        if (cancelled) return;
        setTemplate(body.template);
        if (body.template) {
          const templateSignature = getEvaluationPlanTemplateSignature(body.template);
          const storedDraft = loadEvaluationPlanDraftFromStorage(window.localStorage, templateSignature);
          if (storedDraft.status === "found") {
            setDraft(storedDraft.draft);
          } else if (storedDraft.status === "template_changed") {
            setDraft(createEmptyEvaluationPlanDraft());
            setStorageNotice("평가계 양식이 변경되었습니다. 이전 양식에서 작성한 초안은 브라우저에 보존하고 새 양식용 입력을 시작합니다.");
          } else if (storedDraft.status === "invalid") {
            setDraft(createEmptyEvaluationPlanDraft());
            setHasInvalidStorage(true);
            setError("브라우저에 저장된 평가계획 초안 형식이 올바르지 않습니다. 기존 데이터를 보호하기 위해 덮어쓰지 않습니다.");
          } else {
            setDraft(createEmptyEvaluationPlanDraft());
          }
        } else {
          setDraft(createEmptyEvaluationPlanDraft());
        }
        setIsDirty(false);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "평가계획 작성 자료를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, []);

  useUnsavedChangesGuard(
    isDirty,
    "저장하지 않은 평가계획 입력 내용이 있습니다. 저장하지 않고 이동하시겠습니까?",
  );

  if (isLoading) {
    return <p className="muted">평가계획 양식과 입력 내용을 불러오는 중입니다.</p>;
  }

  if (error && !template) {
    return <p className="validation-error-box">{error}</p>;
  }

  if (!template) {
    return (
      <p className="notice">
        평가계에서 평가계획 양식을 먼저 설정해야 교과 입력을 시작할 수 있습니다.
      </p>
    );
  }

  if (hasInvalidStorage) {
    return (
      <div className={styles.workspace}>
        <section className="panel">
          <h1 className="page-title">교과 평가계획 작성</h1>
          <p className="validation-error-box">{error}</p>
          <p className="small-copy">
            손상된 원본은 별도 브라우저 백업 키에 보존한 뒤 현재 초안 저장소만 초기화할 수 있습니다.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              if (!window.confirm("손상된 초안을 백업하고 현재 초안 저장소를 초기화하시겠습니까?")) return;
              if (!resetInvalidEvaluationPlanDraftStorage(window.localStorage)) {
                setError("초안 저장소를 초기화하지 못했습니다.");
                return;
              }
              setDraft(createEmptyEvaluationPlanDraft());
              setHasInvalidStorage(false);
              setError(null);
              setStorageNotice("손상된 초안을 별도 백업한 뒤 새 평가계획 입력을 시작합니다.");
            }}
          >
            손상된 초안 백업 후 초기화
          </button>
        </section>
      </div>
    );
  }

  function updateDraft(change: (current: EvaluationPlanDraft) => EvaluationPlanDraft) {
    setDraft(change);
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function updateSection(sectionId: string, change: (current: EvaluationPlanDraftSection) => EvaluationPlanDraftSection) {
    updateDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: change(current.sections[sectionId] ?? { fields: {} }),
      },
    }));
  }

  async function saveDraft(openPreview: boolean) {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!template) return;
      const templateIssues = getEvaluationPlanDraftTemplateIssues(template, draft);
      if (templateIssues.length > 0) {
        const remainingCount = templateIssues.length - 1;
        setError(
          remainingCount > 0
            ? `${templateIssues[0].message} 외 ${remainingCount}건을 확인해 주세요.`
            : templateIssues[0].message,
        );
        return;
      }
      saveEvaluationPlanDraftToStorage(
        window.localStorage,
        getEvaluationPlanTemplateSignature(template),
        draft,
      );
      setIsDirty(false);
      setStorageNotice(null);
      if (openPreview) {
        router.push("/teacher/evaluation-plan/preview");
        return;
      }
      setMessage("평가계획 입력 내용을 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "평가계획 입력 내용을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <section className="panel">
        <h1 className="page-title">교과 평가계획 작성</h1>
        <p className="muted page-intro">
          평가계에서 확정한 양식의 구조는 그대로 유지됩니다. 교과에서는 지정된 입력칸의 내용만 작성합니다.
        </p>
        {storageNotice ? <p className="notice">{storageNotice}</p> : null}
        <div className="form-grid three-columns">
          <label className="field">
            <span>학년도</span>
            <input
              inputMode="numeric"
              maxLength={4}
              placeholder="예: 2027"
              value={draft.academicYear}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "").slice(0, 4);
                updateDraft((current) => ({ ...current, academicYear: value }));
              }}
            />
          </label>
          <label className="field">
            <span>학기</span>
            <select
              value={draft.semester}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "" || value === "1" || value === "2") {
                  updateDraft((current) => ({ ...current, semester: value }));
                }
              }}
            >
              <option value="">선택</option>
              <option value="1">1학기</option>
              <option value="2">2학기</option>
            </select>
          </label>
          <label className="field">
            <span>학년</span>
            <select
              value={draft.grade}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "" || value === "1" || value === "2" || value === "3") {
                  updateDraft((current) => ({ ...current, grade: value }));
                }
              }}
            >
              <option value="">선택</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
            </select>
          </label>
          <label className="field">
            <span>교과</span>
            <input
              maxLength={80}
              placeholder="교과명 입력"
              value={draft.subjectLabel}
              onChange={(event) => updateDraft((current) => ({ ...current, subjectLabel: event.target.value }))}
            />
          </label>
        </div>
      </section>

      {template.sections
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((section) => (
          <TeacherSection
            key={section.id}
            section={section}
            data={draft.sections[section.id] ?? { fields: {} }}
            onChange={(change) => updateSection(section.id, change)}
          />
        ))}

      <section className={`panel ${styles.savePanel}`}>
        <div className={styles.saveButtons}>
          <button
            className="secondary-button"
            type="button"
            disabled={isSaving || !isDirty}
            onClick={() => void saveDraft(false)}
          >
            {isSaving ? "저장 중" : isDirty ? "입력 내용 저장" : "저장됨"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isSaving}
            onClick={() => void saveDraft(true)}
          >
            저장하고 최종본 보기
          </button>
        </div>
        {message ? <p className="validation-success">{message}</p> : null}
        {error ? <p className="validation-error-box">{error}</p> : null}
      </section>
    </div>
  );
}

function TeacherSection({
  section,
  data,
  onChange,
}: {
  section: EvaluationTemplateSection;
  data: EvaluationPlanDraftSection;
  onChange: (change: (current: EvaluationPlanDraftSection) => EvaluationPlanDraftSection) => void;
}) {
  return (
    <section className={`panel ${styles.teacherSection}`} data-level={section.level}>
      <div className={styles.sectionHeadingRow}>
        <h2 className={styles.sectionHeading}>{section.title}</h2>
        <span className="muted small-copy">{section.level}단계</span>
      </div>

      {section.teacherEditableTitle ? (
        <label className={`field ${styles.titleField}`}>
          <span>교과 제목</span>
          <input
            maxLength={120}
            placeholder={section.title}
            value={data.title ?? ""}
            onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
      ) : null}

      {!section.config ? (
        <p className="muted small-copy">이 항목은 하위 항목을 묶는 제목입니다.</p>
      ) : section.config.type === "outline_text" ? (
        <label className="field">
          <span>내용</span>
          <textarea
            rows={8}
            maxLength={30_000}
            value={data.body ?? ""}
            onChange={(event) => onChange((current) => ({ ...current, body: event.target.value }))}
          />
        </label>
      ) : (
        <EvaluationPlanTemplateTable
          table={section.config.table}
          values={data.fields}
          onChange={(fieldKey: string, value: EvaluationPlanDraftFieldValue) => {
            onChange((current) => ({
              ...current,
              fields: { ...current.fields, [fieldKey]: value },
            }));
          }}
        />
      )}
    </section>
  );
}
