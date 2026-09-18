"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AcademicCalendarEvent } from "@/modules/academic-calendar";
import {
  applyTeacherEvaluationContext,
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanDraftTemplateIssues,
  getEvaluationPlanTemplateSignature,
  loadEvaluationPlanDraftFromStorage,
  type EvaluationPlanDraft,
  type TeacherEvaluationContext,
} from "@/modules/evaluation-plan";
import type { EvaluationTemplate } from "@/modules/template";
import { authenticatedFetch } from "@/shared/firebase/authenticated-fetch";
import { buildRawEvaluationPlanDocument } from "../application/raw-evaluation-plan-document";
import { RawEvaluationPlanDocument } from "./RawEvaluationPlanDocument";

import styles from "./RawEvaluationPlanPreviewWorkspace.module.css";

type WorkspaceApiResponse = {
  template: EvaluationTemplate | null;
  teacherContext: TeacherEvaluationContext;
  calendarEvents: AcademicCalendarEvent[];
  error?: string;
};

export function RawEvaluationPlanPreviewWorkspace() {
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [teacherContext, setTeacherContext] = useState<TeacherEvaluationContext | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>([]);
  const [draft, setDraft] = useState<EvaluationPlanDraft>(createEmptyEvaluationPlanDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      try {
        const response = await authenticatedFetch("/api/teacher/evaluation-plan");
        const body = (await response.json()) as WorkspaceApiResponse;
        if (!response.ok) throw new Error(body.error ?? "평가계획 양식을 불러오지 못했습니다.");
        if (cancelled) return;
        setTemplate(body.template);
        setTeacherContext(body.teacherContext);
        setCalendarEvents(body.calendarEvents);
        if (!body.template) {
          setDraft(createEmptyEvaluationPlanDraft(body.teacherContext));
          return;
        }

        const storedDraft = loadEvaluationPlanDraftFromStorage(
          window.localStorage,
          getEvaluationPlanTemplateSignature(body.template, body.teacherContext),
        );
        if (storedDraft.status === "found") {
          setDraft(applyTeacherEvaluationContext(storedDraft.draft, body.teacherContext));
        } else if (storedDraft.status === "template_changed") {
          setDraft(createEmptyEvaluationPlanDraft(body.teacherContext));
          setNotice("평가계 양식이 변경되어 현재 양식과 일치하는 저장 초안이 없습니다. 이전 양식 초안은 브라우저에 보존되어 있습니다.");
        } else if (storedDraft.status === "invalid") {
          setError("브라우저에 저장된 평가계획 초안 형식이 올바르지 않아 최종본을 구성하지 않았습니다.");
        } else {
          setDraft(createEmptyEvaluationPlanDraft(body.teacherContext));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "평가계획 최종본을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(
    () => template && teacherContext
      ? buildRawEvaluationPlanDocument(template, draft, { teacherContext, calendarEvents })
      : null,
    [calendarEvents, draft, teacherContext, template],
  );
  const templateIssues = useMemo(
    () => template && teacherContext
      ? getEvaluationPlanDraftTemplateIssues(template, draft, { teacherContext, calendarEvents })
      : [],
    [calendarEvents, draft, teacherContext, template],
  );

  if (isLoading) {
    return <p className="muted">최종 평가계획본을 구성하는 중입니다.</p>;
  }
  if (error) {
    return <p className="validation-error-box">{error}</p>;
  }
  if (!view) {
    return <p className="notice">평가계에서 평가계획 양식을 먼저 설정해 주세요.</p>;
  }
  if (templateIssues.length > 0) {
    return (
      <div className={styles.previewWorkspace}>
        <div className="validation-error-box">
          <p>최종본을 만들기 전에 다음 입력 내용을 확인해 주세요.</p>
          <ul>
            {templateIssues.slice(0, 10).map((issue) => (
              <li key={`${issue.sectionId}:${issue.fieldKey}`}>{issue.message}</li>
            ))}
          </ul>
          {templateIssues.length > 10 ? <p>외 {templateIssues.length - 10}건이 더 있습니다.</p> : null}
        </div>
        <div>
          <Link href="/teacher/evaluation-plan">입력 화면으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.previewWorkspace}>
      <div className={styles.previewToolbar}>
        <div>
          <h1 className="page-title">최종 평가계획본 확인</h1>
          <p className="muted">디자인 가공 전 raw 문서입니다. 내용 구조와 페이지 출력 상태를 확인합니다.</p>
          {notice ? <p className="notice">{notice}</p> : null}
        </div>
        <div className={styles.previewActions}>
          <Link className="secondary-button" href="/teacher/evaluation-plan">입력 화면으로</Link>
          <button className="secondary-button" type="button" onClick={() => window.print()}>
            인쇄 미리보기
          </button>
        </div>
      </div>
      <RawEvaluationPlanDocument view={view} />
    </div>
  );
}
