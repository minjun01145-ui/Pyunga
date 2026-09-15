import { PerformanceAssessmentEditor } from "@/modules/performance-assessment/ui/PerformanceAssessmentEditor";

export default function PerformancePrototypePage() {
  return (
    <main>
      <h1 className="page-title">수행평가 입력기 프로토타입</h1>
      <p className="muted page-intro">
        Phase 2에서는 저장·로그인보다 수행평가 데이터 구조와 평가기준 편집 방식이 실제 업무에 맞는지 검증합니다.
      </p>
      <PerformanceAssessmentEditor />
    </main>
  );
}
