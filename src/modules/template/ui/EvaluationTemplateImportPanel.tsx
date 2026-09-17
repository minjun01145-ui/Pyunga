"use client";

import { useState, type FormEvent } from "react";

import styles from "./EvaluationTemplateSectionWorkspace.module.css";

type EvaluationTemplateImportPanelProps = {
  isLoading: boolean;
  elapsedSeconds: number;
  onImport: (file: File) => void;
};

export function EvaluationTemplateImportPanel({
  isLoading,
  elapsedSeconds,
  onImport,
}: EvaluationTemplateImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setFileError("불러올 평가계획 PDF를 선택해 주세요.");
      return;
    }

    setFileError(null);
    onImport(file);
  }

  return (
    <section className="panel">
      <h2 className="subsection-title">전년도 평가계획 불러오기</h2>
      <p className="muted small-copy">
        전년도 평가계획 PDF에서 학교 공통 문서 구조와 교과별 반복 항목을 구분해 양식 초안을 만듭니다.
      </p>
      <form className={styles.importForm} onSubmit={handleSubmit}>
        <label className="field">
          <span>평가계획 PDF</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(changeEvent) => {
              setFile(changeEvent.target.files?.[0] ?? null);
              setFileError(null);
            }}
          />
        </label>
        <button className="secondary-button align-start" type="submit" disabled={isLoading}>
          {isLoading ? `불러오는 중 · ${elapsedSeconds}초` : "평가계획 불러오기"}
        </button>
      </form>
      <p className={`muted small-copy ${styles.importNote}`}>
        {isLoading
          ? "문서 분량에 따라 분석에 시간이 걸릴 수 있습니다. 완료될 때까지 이 화면을 닫지 마세요."
          : "분석 결과는 초안입니다. 공통 구조와 교과별 반복 항목 구분을 확인한 뒤 저장해 주세요."}
      </p>
      {fileError ? <p className="validation-error-box">{fileError}</p> : null}
    </section>
  );
}
