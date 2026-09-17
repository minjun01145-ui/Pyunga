"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import { AiCallMetricsPanel, type AiCallMetrics } from "../../ai-review";
import type { AcademicCalendarImportCandidate } from "../application/academic-calendar-import";

type ImportApiResponse = {
  documentTitle?: string;
  events: AcademicCalendarImportCandidate[];
  warnings: string[];
  aiCall: AiCallMetrics;
  source: {
    fileName: string;
    totalPages: number;
    selectedPages: number[];
  };
};

type ApiErrorResponse = {
  error?: string;
};

const eventTypeLabels: Record<AcademicCalendarImportCandidate["type"], string> = {
  written_exam: "정기고사",
  school_event: "학교행사",
  vacation: "방학",
  other: "기타",
};

export function AcademicCalendarImportWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState(() => getDefaultAcademicYear());
  const [result, setResult] = useState<ImportApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      return;
    }

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

    const formData = new FormData();
    formData.set("file", file);
    formData.set("academicYear", String(academicYear));

    try {
      const response = await fetch("/api/admin/evaluation/academic-calendar/import", {
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

  return (
    <div className="workspace-stack">
      <section className="panel">
        <h2 className="subsection-title">교육계획서에서 학사일정 가져오기</h2>
        <p className="muted small-copy">
          PDF의 학사일정 관련 페이지를 찾아 AI로 문서에 기록된 모든 일정과 정기고사를 구조화합니다. 분석 결과는 바로 저장되지 않으며,
          먼저 아래 표에서 확인합니다.
        </p>

        <form className="calendar-import-form" onSubmit={handleSubmit}>
          <label className="field calendar-year-field">
            <span>학년도</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={academicYear}
              onChange={(changeEvent) => setAcademicYear(Number(changeEvent.target.value))}
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
                <h2 className="subsection-title">분석 결과</h2>
                <p className="muted small-copy">
                  {result.documentTitle ?? result.source.fileName} · 전체 {result.source.totalPages}
                  쪽 중 분석 페이지 {formatPages(result.source.selectedPages)}
                </p>
              </div>
              <p className="small-copy">
                {result.events.length}개 일정 · 확인 필요 {issueCount}건
              </p>
            </div>

            {result.warnings.length > 0 ? (
              <div className="notice calendar-warning-box">
                <strong>문서 확인 사항</strong>
                <ul>
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="calendar-table-scroll">
              <table className="simple-table calendar-import-table">
                <thead>
                  <tr>
                    <th>학기</th>
                    <th>구분</th>
                    <th>일정</th>
                    <th>대상</th>
                    <th>기간</th>
                    <th>근거</th>
                    <th>확인</th>
                  </tr>
                </thead>
                <tbody>
                  {result.events.map((calendarEvent, index) => (
                    <tr key={`${calendarEvent.startDate}-${calendarEvent.title}-${index}`}>
                      <td>{calendarEvent.semester}학기</td>
                      <td>{eventTypeLabels[calendarEvent.type]}</td>
                      <td>{calendarEvent.title}</td>
                      <td>{formatGrades(calendarEvent.targetGrades)}</td>
                      <td>{formatDateRange(calendarEvent.startDate, calendarEvent.endDate)}</td>
                      <td className="calendar-source-cell">{calendarEvent.sourceText}</td>
                      <td>
                        {calendarEvent.issues.length > 0 ? (
                          <ul className="calendar-issue-list">
                            {calendarEvent.issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="muted small-copy calendar-review-note">
              이 단계는 AI가 제안한 일정을 검토하는 화면입니다. 분석 결과는 아직 학교 공식
              학사일정에 반영되지 않았습니다.
            </p>
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

function formatGrades(grades: readonly number[]): string {
  return grades.length > 0 ? `${grades.join(", ")}학년` : "전체/미지정";
}

function formatDateRange(startDate: string, endDate?: string): string {
  return endDate && endDate !== startDate ? `${startDate} ~ ${endDate}` : startDate;
}

function formatPages(pages: readonly number[]): string {
  return pages.length > 0 ? pages.join(", ") : "-";
}
