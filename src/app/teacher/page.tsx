import Link from "next/link";

export default function TeacherPage() {
  return (
    <main>
      <h1 className="page-title">교사용 평가계획</h1>
      <p className="muted page-intro">평가계가 설정한 학교 양식에 맞춰 교과 내용을 작성합니다.</p>
      <section className="panel">
        <h2 className="section-title first-section-title">평가계획 작성</h2>
        <p className="small-copy">교과 기본정보와 각 양식 항목의 실제 내용을 입력하고 raw 최종본을 확인합니다.</p>
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
