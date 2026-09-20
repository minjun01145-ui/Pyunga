"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { authenticatedFetch } from "@/modules/auth/client";
import { AiCallMetricsPanel, type AiCallMetrics } from "../../ai-review";
import type { AcademicCalendarImportCandidate } from "../application/academic-calendar-import";
import type { AcademicCalendarEventType, SchoolGrade, WrittenExamKind } from "../domain/academic-calendar-event";
import {
  groupAcademicCalendarEventsByPeriod,
  type AcademicCalendarPeriodUnit,
} from "../domain/academic-calendar-period";
import { getAcademicCalendarEventIssues } from "../domain/academic-calendar-validation";

type ImportApiResponse = {
  documentTitle?: string;
  events: AcademicCalendarImportCandidate[];
  warnings: string[];
  aiCall: AiCallMetrics;
  source: { fileName: string; totalPages: number; selectedPages: number[] };
};

type ApiErrorResponse = { error?: string };

const eventTypeLabels: Record<AcademicCalendarEventType, string> = {
  written_exam: "정기고사",
  school_event: "학교행사",
  vacation: "방학",
  other: "기타",
};
const eventTypes: AcademicCalendarEventType[] = ["written_exam", "school_event", "vacation", "other"];
const schoolGrades = [1, 2, 3] as const;
const writtenExamKinds: WrittenExamKind[] = ["midterm", "final", "other"];
const writtenExamKindLabels: Record<WrittenExamKind, string> = {
  midterm: "중간고사",
  final: "기말고사",
  other: "기타 정기고사",
};

export function AcademicCalendarImportWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState(() => getDefaultAcademicYear());
  const [result, setResult] = useState<ImportApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [periodUnit, setPeriodUnit] = useState<AcademicCalendarPeriodUnit>("month_week");

  useEffect(() => {
    if (!isLoading) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const issueCount = useMemo(
    () => result?.events.reduce((sum, event) => sum + event.issues.length, 0) ?? 0,
    [result],
  );
  const teachingPeriods = useMemo(
    () => groupAcademicCalendarEventsByPeriod(result?.events ?? [], periodUnit),
    [periodUnit, result?.events],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("분석할 PDF 파일을 선택해 주세요.");
      return;
    }

    setIsLoading(true);
    setElapsedSeconds(0);
    setError(null);
    setResult(null);
    setSaveMessage(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("academicYear", String(academicYear));

    try {
      const response = await authenticatedFetch("/api/admin/evaluation/academic-calendar/import", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as ImportApiResponse | ApiErrorResponse;
      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "학사일정 분석에 실패했습니다.");
      }
      setResult(body as ImportApiResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "학사일정 분석에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    if (result.events.length === 0) {
      setError("저장할 학사일정을 하나 이상 입력해 주세요.");
      return;
    }
    if (issueCount > 0) {
      setError("확인이 필요한 일정을 모두 수정한 뒤 저장해 주세요.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveMessage(null);
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/academic-calendar", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYear, events: result.events.map(toSaveEvent) }),
      });
      const body = (await response.json()) as { savedCount?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? "학사일정 저장에 실패했습니다.");
      setSaveMessage(`${body.savedCount ?? result.events.length}개 일정을 저장했습니다.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "학사일정 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateEvent(
    index: number,
    updater: (calendarEvent: AcademicCalendarImportCandidate) => AcademicCalendarImportCandidate,
  ) {
    setResult((current) => current ? {
      ...current,
      events: current.events.map((calendarEvent, eventIndex) =>
        eventIndex === index ? withCurrentIssues(updater(calendarEvent), academicYear) : calendarEvent,
      ),
    } : current);
    setSaveMessage(null);
  }

  function addEvent() {
    const calendarEvent = withCurrentIssues({
      academicYear,
      title: "",
      type: "other",
      semester: 1,
      startDate: `${academicYear}-03-01`,
      targetGrades: [],
      sourceText: "사용자 직접 추가",
      issues: [],
    }, academicYear);
    setResult((current) => current ? { ...current, events: [...current.events, calendarEvent] } : current);
    setSaveMessage(null);
  }

  function removeEvent(index: number) {
    setResult((current) => current ? {
      ...current,
      events: current.events.filter((_, eventIndex) => eventIndex !== index),
    } : current);
    setSaveMessage(null);
  }

  return (
    <div className="workspace-stack">
      <section className="panel">
        <h2 className="subsection-title">교육계획서에서 학사일정 가져오기</h2>
        <p className="muted small-copy">
          PDF의 학사일정 관련 페이지를 찾아 AI로 문서에 기록된 일정을 구조화합니다. 분석 결과는 바로 저장되지 않으며, 아래 표에서 수정하고 확인합니다.
        </p>
        <form className="calendar-import-form" onSubmit={handleSubmit}>
          <label className="field calendar-year-field">
            <span>학년도</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={academicYear}
              onChange={(changeEvent) => {
                const nextAcademicYear = Number(changeEvent.target.value);
                setAcademicYear(nextAcademicYear);
                setResult((current) => current ? {
                  ...current,
                  events: current.events.map((calendarEvent) => withCurrentIssues({
                    ...calendarEvent,
                    academicYear: nextAcademicYear,
                  }, nextAcademicYear)),
                } : current);
                setSaveMessage(null);
              }}
            />
          </label>
          <label className="field calendar-file-field">
            <span>교육계획서 PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(changeEvent) => setFile(changeEvent.target.files?.[0] ?? null)}
            />
          </label>
          <button className="secondary-button align-start" type="submit" disabled={isLoading}>
            {isLoading ? `분석 중 · ${elapsedSeconds}초` : "학사일정 분석"}
          </button>
        </form>
        <p className="muted small-copy calendar-import-note">
          {isLoading
            ? "문서 분량에 따라 최대 4분 정도 걸릴 수 있습니다. 분석이 끝날 때까지 이 화면을 닫지 마세요."
            : "업로드한 PDF의 관련 텍스트는 서버에서 추출된 뒤 설정된 AI 서비스로 전송됩니다. API 키는 브라우저로 전달하지 않습니다."}
        </p>
        {error ? <p className="validation-error-box">{error}</p> : null}
      </section>

      {result ? (
        <>
          <section className="panel">
            <div className="calendar-result-header">
              <div>
                <h2 className="subsection-title">분석 결과 수정</h2>
                <p className="muted small-copy">
                  {result.documentTitle ?? result.source.fileName} · 전체 {result.source.totalPages}쪽 중 분석 페이지 {formatPages(result.source.selectedPages)}
                </p>
              </div>
              <p className="small-copy">{result.events.length}개 일정 · 확인 필요 {issueCount}건</p>
            </div>

            {result.warnings.length > 0 ? (
              <div className="notice calendar-warning-box">
                <strong>문서 확인 사항</strong>
                <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            ) : null}

            <div className="calendar-table-scroll">
              <table className="simple-table calendar-import-table calendar-edit-table">
                <thead>
                  <tr><th>학기</th><th>구분</th><th>일정</th><th>대상</th><th>기간</th><th>근거</th><th>확인</th><th>작업</th></tr>
                </thead>
                <tbody>
                  {result.events.map((calendarEvent, index) => (
                    <tr key={`${calendarEvent.startDate}-${calendarEvent.title}-${index}`}>
                      <td>
                        <select
                          aria-label={`${index + 1}번 일정 학기`}
                          value={calendarEvent.semester}
                          onChange={(changeEvent) => updateEvent(index, (current) => ({
                            ...current,
                            semester: changeEvent.target.value === "2" ? 2 : 1,
                          }))}
                        >
                          <option value={1}>1학기</option><option value={2}>2학기</option>
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`${index + 1}번 일정 구분`}
                          value={calendarEvent.type}
                          onChange={(changeEvent) => updateEvent(index, (current) => {
                            const type = parseEventType(changeEvent.target.value);
                            return { ...current, type, writtenExamKind: type === "written_exam" ? current.writtenExamKind : undefined };
                          })}
                        >
                          {eventTypes.map((type) => <option key={type} value={type}>{eventTypeLabels[type]}</option>)}
                        </select>
                        {calendarEvent.type === "written_exam" ? (
                          <select
                            aria-label={`${index + 1}번 일정 정기고사 구분`}
                            value={calendarEvent.writtenExamKind ?? ""}
                            onChange={(changeEvent) => updateEvent(index, (current) => ({
                              ...current,
                              writtenExamKind: parseWrittenExamKind(changeEvent.target.value),
                            }))}
                          >
                            <option value="">선택</option>
                            {writtenExamKinds.map((kind) => <option key={kind} value={kind}>{writtenExamKindLabels[kind]}</option>)}
                          </select>
                        ) : null}
                      </td>
                      <td>
                        <input
                          aria-label={`${index + 1}번 일정명`}
                          maxLength={120}
                          value={calendarEvent.title}
                          onChange={(changeEvent) => updateEvent(index, (current) => ({ ...current, title: changeEvent.target.value }))}
                        />
                      </td>
                      <td>
                        <div className="calendar-grade-options">
                          {schoolGrades.map((grade) => (
                            <label key={grade}>
                              <input
                                type="checkbox"
                                checked={calendarEvent.targetGrades.includes(grade)}
                                onChange={() => updateEvent(index, (current) => ({
                                  ...current,
                                  targetGrades: toggleGrade(current.targetGrades, grade),
                                }))}
                              />
                              {grade}학년
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="calendar-date-inputs">
                          <input
                            aria-label={`${index + 1}번 일정 시작일`}
                            type="date"
                            value={calendarEvent.startDate}
                            onChange={(changeEvent) => updateEvent(index, (current) => ({ ...current, startDate: changeEvent.target.value }))}
                          />
                          <span>~</span>
                          <input
                            aria-label={`${index + 1}번 일정 종료일`}
                            type="date"
                            value={calendarEvent.endDate ?? ""}
                            onChange={(changeEvent) => updateEvent(index, (current) => ({
                              ...current,
                              endDate: changeEvent.target.value || undefined,
                            }))}
                          />
                        </div>
                      </td>
                      <td className="calendar-source-cell">{calendarEvent.sourceText}</td>
                      <td>
                        {calendarEvent.issues.length > 0 ? (
                          <ul className="calendar-issue-list">{calendarEvent.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                        ) : "-"}
                      </td>
                      <td>
                        <button className="text-button danger-text" type="button" onClick={() => removeEvent(index)}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="secondary-button" type="button" onClick={addEvent}>일정 추가</button>
            <p className="muted small-copy calendar-review-note">
              PDF 분석 결과는 초안입니다. 확인 필요 항목을 모두 수정한 뒤 저장해 주세요.
            </p>
            <div className="save-actions">
              <button className="secondary-button" type="button" disabled={isSaving} onClick={handleSave}>
                {isSaving ? "저장 중" : "저장"}
              </button>
              {saveMessage ? <p className="validation-success">{saveMessage}</p> : null}
            </div>
          </section>

          <section className="panel">
            <div className="calendar-period-header">
              <div>
                <h2 className="subsection-title">교수학습표용 일정</h2>
                <p className="muted small-copy">
                  수정한 일정을 월별 또는 월·주별로 묶은 결과입니다. 월·주별은 월요일~일요일을 한 주로 보고, 그 주의 목요일이 속한 달로 표시합니다.
                </p>
              </div>
              <div className="segmented-control" aria-label="일정 묶기 방식">
                <button className={`segment${periodUnit === "month" ? " active" : ""}`} type="button" onClick={() => setPeriodUnit("month")}>월별</button>
                <button className={`segment${periodUnit === "month_week" ? " active" : ""}`} type="button" onClick={() => setPeriodUnit("month_week")}>월·주별</button>
              </div>
            </div>
            <div className="calendar-table-scroll">
              <table className="simple-table calendar-period-table">
                <thead><tr><th>시기</th><th>기간</th><th>학사일정</th></tr></thead>
                <tbody>
                  {teachingPeriods.map((period) => (
                    <tr key={period.key}>
                      <td>{period.label}</td>
                      <td>{formatDateRange(period.startDate, period.endDate)}</td>
                      <td>
                        {period.events.map((calendarEvent, index) => (
                          <div key={`${calendarEvent.startDate}-${calendarEvent.title}-${index}`}>
                            {calendarEvent.title} ({formatDateRange(calendarEvent.startDate, calendarEvent.endDate)})
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {teachingPeriods.length === 0 ? <tr><td colSpan={3} className="muted">표시할 일정이 없습니다.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </section>
          <AiCallMetricsPanel metrics={result.aiCall} />
        </>
      ) : null}
    </div>
  );
}

function getDefaultAcademicYear(): number {
  const today = new Date();
  return today.getMonth() < 2 ? today.getFullYear() - 1 : today.getFullYear();
}

function formatDateRange(startDate: string, endDate?: string): string {
  return endDate && endDate !== startDate ? `${startDate} ~ ${endDate}` : startDate;
}

function formatPages(pages: readonly number[]): string {
  return pages.length > 0 ? pages.join(", ") : "-";
}

function withCurrentIssues(
  calendarEvent: AcademicCalendarImportCandidate,
  academicYear: number,
): AcademicCalendarImportCandidate {
  return { ...calendarEvent, issues: getAcademicCalendarEventIssues(calendarEvent, academicYear) };
}

function toggleGrade(grades: readonly SchoolGrade[], grade: SchoolGrade): SchoolGrade[] {
  return grades.includes(grade)
    ? grades.filter((current) => current !== grade)
    : [...grades, grade].sort((left, right) => left - right);
}

function parseEventType(value: string): AcademicCalendarEventType {
  return eventTypes.find((type) => type === value) ?? "other";
}

function parseWrittenExamKind(value: string): WrittenExamKind | undefined {
  return writtenExamKinds.find((kind) => kind === value);
}

function toSaveEvent(calendarEvent: AcademicCalendarImportCandidate) {
  return {
    academicYear: calendarEvent.academicYear,
    title: calendarEvent.title,
    type: calendarEvent.type,
    semester: calendarEvent.semester,
    startDate: calendarEvent.startDate,
    endDate: calendarEvent.endDate,
    targetGrades: calendarEvent.targetGrades,
    writtenExamKind: calendarEvent.writtenExamKind,
    sourceText: calendarEvent.sourceText,
  };
}
