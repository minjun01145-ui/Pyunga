"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { AcademicCalendarEvent } from "@/modules/academic-calendar";
import {
  buildTeachingLearningCalendarRows,
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanDraftTemplateIssues,
  getEvaluationPlanTemplateSignature,
  EVALUATION_PLAN_STATUS_LABELS,
  getEvaluationPlanSubmissionIssues,
  type EvaluationPlanWorkspaceData,
  type SavedEvaluationPlan,
  type EvaluationPlanDraft,
  type EvaluationPlanDraftFieldValue,
  type EvaluationPlanDraftSection,
  type TeacherEvaluationContext,
} from "@/modules/evaluation-plan";
import type { EvaluationTemplate, EvaluationTemplateSection } from "@/modules/template";
import { authenticatedFetch } from "@/modules/auth/client";
import { useUnsavedChangesGuard } from "@/shared/ui/useUnsavedChangesGuard";
import {
  loadEvaluationPlanDraftBootstrap,
  resetInvalidEvaluationPlanDraftStorage,
  saveEvaluationPlanDraftToStorage,
} from "../infrastructure/browser-evaluation-plan-draft";

import { EvaluationPlanTemplateTable } from "./EvaluationPlanTemplateTable";
import styles from "./EvaluationPlanWorkspace.module.css";

export function EvaluationPlanWorkspace() {
  const router = useRouter();
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [teacherContext, setTeacherContext] = useState<TeacherEvaluationContext | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>([]);
  const [draft, setDraft] = useState<EvaluationPlanDraft>(createEmptyEvaluationPlanDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [hasInvalidStorage, setHasInvalidStorage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPlan, setSavedPlan] = useState<SavedEvaluationPlan | null>(null);
  const [templateRevision, setTemplateRevision] = useState(0);
  const [persistence, setPersistence] = useState<"browser" | "server">("browser");
  const [teachingGrades, setTeachingGrades] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      try {
        const response = await authenticatedFetch(`/api/teacher/evaluation-plan${window.location.search}`);
        const body = (await response.json()) as EvaluationPlanWorkspaceData;
        if (!response.ok) throw new Error(body.error ?? "평가계획 작성 자료를 불러오지 못했습니다.");
        if (cancelled) return;
        setTemplate(body.template);
        setTeacherContext(body.teacherContext);
        setCalendarEvents(body.calendarEvents);
        setTemplateRevision(body.templateRevision);
        setPersistence(body.persistence);
        setTeachingGrades(body.teachingGrades);
        setSavedPlan(body.savedPlan);
        if (body.persistence === "server") {
          setDraft(body.savedPlan?.draft ?? createEmptyEvaluationPlanDraft(body.teacherContext));
          if (body.savedPlan?.status === "submitted" || body.savedPlan?.status === "approved") {
            setTemplate(body.savedPlan.template);
            setCalendarEvents(body.savedPlan.calendarEvents);
            return;
          }
          if (body.savedPlan && body.template && body.savedPlan.templateSignature !== getEvaluationPlanTemplateSignature(body.template, body.teacherContext)) {
            setStorageNotice("학교 양식이 변경되었습니다. 저장된 내용은 보존되어 있습니다. 현재 양식의 입력칸을 확인한 뒤 저장해 주세요.");
          }
          return;
        }
        const bootstrap = loadEvaluationPlanDraftBootstrap(
          window.localStorage,
          body.template,
          body.teacherContext,
        );
        setDraft(bootstrap.draft);
        if (bootstrap.status === "template_changed") {
          setStorageNotice("평가계 양식이 변경되었습니다. 이전 양식에서 작성한 초안은 브라우저에 보존하고 새 양식용 입력을 시작합니다.");
        } else if (bootstrap.status === "invalid") {
          setHasInvalidStorage(true);
          setError("브라우저에 저장된 평가계획 초안 형식이 올바르지 않습니다. 기존 데이터를 보호하기 위해 덮어쓰지 않습니다.");
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

  if (!template || !teacherContext) {
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
              setDraft(createEmptyEvaluationPlanDraft(teacherContext));
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

  async function saveDraft(openPreview: boolean, submit = false) {
    setIsSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (!template || !teacherContext) return;
      const templateIssues = submit ? getEvaluationPlanSubmissionIssues(template, draft, teacherContext, calendarEvents) : [];
      if (templateIssues.length > 0) {
        const remainingCount = templateIssues.length - 1;
        setError(
          remainingCount > 0
            ? `${templateIssues[0]} 외 ${remainingCount}건을 확인해 주세요.`
            : templateIssues[0],
        );
        return;
      }
      if (persistence === "server") {
        const response = await authenticatedFetch("/api/teacher/evaluation-plan", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft, expectedRevision: savedPlan?.revision ?? 0, expectedTemplateRevision: templateRevision, action: submit ? "submit" : "save" }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "평가계획을 저장하지 못했습니다.");
        setSavedPlan(body.savedPlan);
      } else {
        saveEvaluationPlanDraftToStorage(window.localStorage, getEvaluationPlanTemplateSignature(template, teacherContext), draft);
      }
      setIsDirty(false);
      setStorageNotice(null);
      if (openPreview) {
        router.push(`/teacher/evaluation-plan/preview?grade=${teacherContext.grade}`);
        return;
      }
      setMessage(submit ? "평가계에 제출했습니다." : "평가계획 입력 내용을 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "평가계획 입력 내용을 저장하지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const locked = savedPlan?.status === "submitted" || savedPlan?.status === "approved";

  return (
    <div className={styles.workspace}>
      <section className="panel">
        <h1 className="page-title">교과 평가계획 작성</h1>
        <p className="muted page-intro">
          평가계에서 확정한 양식의 구조는 그대로 유지됩니다. 교과에서는 지정된 입력칸의 내용만 작성합니다.
        </p>
        {storageNotice ? <p className="notice">{storageNotice}</p> : null}
        <p className="small-copy">{persistence === "browser" ? "체험 모드: 입력 내용은 이 브라우저에 저장됩니다. 제출은 로그인 후 이용할 수 있습니다." : `상태: ${EVALUATION_PLAN_STATUS_LABELS[savedPlan?.status ?? "draft"]}`}</p>
        {savedPlan?.reviewComment ? <p className="notice">검토 의견: {savedPlan.reviewComment}</p> : null}
        {teachingGrades.length > 1 ? <nav aria-label="담당 학년" className={styles.saveButtons}>{teachingGrades.map((grade) => <a key={grade} href={`/teacher/evaluation-plan?grade=${grade}`} aria-current={teacherContext.grade === grade ? "page" : undefined}>{grade}학년</a>)}</nav> : null}
        <p className={styles.teacherContextLine}>
          <strong>{teacherContext.academicYear}학년도 {teacherContext.semester}학기</strong>
          <span>{teacherContext.grade}학년</span>
          <span>{teacherContext.subjectLabel}</span>
        </p>
      </section>

      <fieldset disabled={locked || isSaving} className={styles.inputSections}>
      {template.sections
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((section) => (
          <TeacherSection
            key={section.id}
            section={section}
            data={draft.sections[section.id] ?? { fields: {} }}
            teacherContext={teacherContext}
            calendarEvents={calendarEvents}
            onChange={(change) => updateSection(section.id, change)}
          />
        ))}
      </fieldset>

      <section className={`panel ${styles.savePanel}`}>
        <div className={styles.saveButtons}>
          {locked ? <Link className="secondary-button" href={`/teacher/evaluation-plan/preview?grade=${teacherContext.grade}`}>제출본 보기·인쇄</Link> : <>
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
          <button className="secondary-button" type="button" disabled={isSaving} onClick={() => {
            const issues = getEvaluationPlanDraftTemplateIssues(template, draft, { teacherContext, calendarEvents });
            setError(issues.length ? issues.slice(0, 10).map((issue) => issue.message).join("\n") : null);
            setMessage(issues.length ? null : "입력 형식과 필수 항목 확인을 완료했습니다.");
          }}>입력 확인</button>
          {persistence === "server" ? <button className="secondary-button" type="button" disabled={isSaving} onClick={() => {
            if (window.confirm("평가계에 제출하시겠습니까? 제출 후에는 반려받은 계획만 수정할 수 있습니다.")) void saveDraft(false, true);
          }}>평가계에 제출</button> : null}
          </>}
        </div>
        {message ? <p className="validation-success">{message}</p> : null}
        {error ? <p role="alert" className={`validation-error-box ${styles.errorMessage}`}>{error}</p> : null}
      </section>
    </div>
  );
}

function TeacherSection({
  section,
  data,
  teacherContext,
  calendarEvents,
  onChange,
}: {
  section: EvaluationTemplateSection;
  data: EvaluationPlanDraftSection;
  teacherContext: TeacherEvaluationContext;
  calendarEvents: AcademicCalendarEvent[];
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
        <p className="validation-error-box">평가계에서 이 항목의 입력 양식을 아직 설정하지 않았습니다.</p>
      ) : section.config.type === "title_only" ? (
        <p className="muted small-copy">최종 문서에 제목만 표시되는 항목입니다.</p>
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
        <>
          {section.config.type === "teaching_learning_table" && section.config.calendarRows.enabled ? (() => {
            const calendarRows = buildTeachingLearningCalendarRows(section.config, calendarEvents, teacherContext);
            if (calendarRows.length === 0) {
              return <p className="notice">이 학기·학년에 해당하는 저장된 학사일정이 없어 교수학습표 행을 만들 수 없습니다.</p>;
            }
            return (
              <EvaluationPlanTemplateTable
                table={section.config.table}
                values={data.fields}
                onChange={() => undefined}
                calendarRows={calendarRows}
                rowValues={data.rows}
                onRowChange={(rowKey, fieldKey, value) => {
                  onChange((current) => ({
                    ...current,
                    rows: {
                      ...current.rows,
                      [rowKey]: {
                        fields: {
                          ...(current.rows?.[rowKey]?.fields ?? {}),
                          [fieldKey]: value,
                        },
                      },
                    },
                  }));
                }}
              />
            );
          })() : (
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
        </>
      )}
    </section>
  );
}
