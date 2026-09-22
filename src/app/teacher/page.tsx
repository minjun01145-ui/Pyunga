import Link from "next/link";

export default function TeacherPage() {
  return (
    <main>
      <h1 className="page-title">교사용 평가계획</h1>
      <p className="muted page-intro">평가계가 설정한 학교 양식에 맞춰 교과 내용을 작성합니다.</p>
      <section className="panel">
        <h2 className="section-title first-section-title">평가계획 작성</h2>
        <p className="small-copy">담당 학년의 평가계획을 작성·저장하고 학교 양식으로 출력하거나 평가계에 제출합니다.</p>
        <Link href="/teacher/evaluation-plan">평가계획 작성 화면 열기</Link>
      </section>
      <section className="panel">
        <h2 className="section-title first-section-title">수행평가 구조 시험</h2>
        <p className="small-copy">수행평가 채점 구조를 별도로 시험하는 기존 프로토타입입니다.</p>
        <Link href="/teacher/performance-prototype">수행평가 구조 시험 열기</Link>
      </section>
    </main>
  );
}
