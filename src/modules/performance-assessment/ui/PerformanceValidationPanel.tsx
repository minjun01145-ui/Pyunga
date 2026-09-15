"use client";

import type { PerformanceAssessment, PerformanceValidationError } from "@/modules/performance-assessment";
import { formatPerformanceValidationError } from "./scoring-validation-message";

type Props = {
  assessment: PerformanceAssessment;
  errors: PerformanceValidationError[];
  showRawData: boolean;
  onToggleRawData: () => void;
};

export function PerformanceValidationPanel({ assessment, errors, showRawData, onToggleRawData }: Props) {
  return (
    <section className="panel">
      <div className="section-editor-header">
        <h2 className="section-title first-section-title">검증 결과</h2>
        <button type="button" className="secondary-button" onClick={onToggleRawData}>
          {showRawData ? "구조 데이터 닫기" : "구조 데이터 보기"}
        </button>
      </div>

      {errors.length === 0 ? (
        <p className="validation-success">현재 구조에서 발견된 오류가 없습니다.</p>
      ) : (
        <div className="validation-error-box">
          <strong>{errors.length}건의 확인사항이 있습니다.</strong>
          <ul>
            {errors.map((error, index) => (
              <li key={`${error.code}-${index}`}>{formatPerformanceValidationError(error)}</li>
            ))}
          </ul>
        </div>
      )}

      {showRawData ? <pre className="raw-data">{JSON.stringify(assessment, null, 2)}</pre> : null}
    </section>
  );
}
