"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { AcademicCalendarEvent } from "@/modules/academic-calendar";
import {
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanDraftTemplateIssues,
  loadEvaluationPlanDraftBootstrap,
  type EvaluationPlanDraft,
  type TeacherEvaluationContext,
  type EvaluationPlanWorkspaceData,
} from "@/modules/evaluation-plan";
import type { EvaluationTemplate } from "@/modules/template";
import { authenticatedFetch } from "@/modules/auth/client";
import { buildRawEvaluationPlanDocument } from "../application/raw-evaluation-plan-document";
import { RawEvaluationPlanDocument } from "./RawEvaluationPlanDocument";

import styles from "./RawEvaluationPlanPreviewWorkspace.module.css";

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
        const response = await authenticatedFetch(`/api/teacher/evaluation-plan${window.location.search}`);
        const body = (await response.json()) as EvaluationPlanWorkspaceData;
        if (!response.ok) throw new Error(body.error ?? "평가계획 양식을 불러오지 못했습니다.");
        if (cancelled) return;
        setTemplate(body.template);
        setTeacherContext(body.savedPlan?.context ?? body.teacherContext);
        setCalendarEvents(body.calendarEvents);
        if (body.persistence === "server") {
          setDraft(body.savedPlan?.draft ?? createEmptyEvaluationPlanDraft(body.teacherContext));
          if (body.savedPlan) {
            setTemplate(body.savedPlan.template);
            setCalendarEvents(body.savedPlan.calendarEvents);
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
          setNotice("평가계 양식이 변경되어 현재 양식과 일치하는 저장 초안이 없습니다. 이전 양식 초안은 브라우저에 보존되어 있습니다.");
        } else if (bootstrap.status === "invalid") {
          setError("브라우저에 저장된 평가계획 초안 형식이 올바르지 않아 최종본을 구성하지 않았습니다.");
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

  return (
    <div className={styles.previewWorkspace}>
      <div className={styles.previewToolbar}>
        <div>
          <h1 className="page-title">평가계획 출력 미리보기</h1>
          <p className="muted">학교 양식으로 출력합니다. 인쇄 창에서 PDF로 저장할 수 있습니다.</p>
          {templateIssues.length ? <details className="notice"><summary>확인이 필요한 항목 {templateIssues.length}건</summary><ul>{templateIssues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul></details> : null}
          {notice ? <p className="notice">{notice}</p> : null}
        </div>
        <div className={styles.previewActions}>
          <Link className="secondary-button" href={`/teacher/evaluation-plan?grade=${teacherContext?.grade ?? ""}`}>입력 화면으로</Link>
          <button className="secondary-button" type="button" onClick={() => window.print()}>
            인쇄·PDF 저장
          </button>
        </div>
      </div>
      <RawEvaluationPlanDocument view={view} />
    </div>
  );
}
