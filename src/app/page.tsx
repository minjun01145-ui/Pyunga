import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1 className="page-title">EvalFlow</h1>
      <p>1단계 프로젝트 골격입니다. 실제 인증과 평가계획 저장 기능은 아직 연결하지 않았습니다.</p>

      <h2 className="section-title">역할별 화면</h2>
      <table className="simple-table">
        <thead>
          <tr>
            <th>역할</th>
            <th>경로</th>
            <th>설명</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>일반 교사</td>
            <td><Link href="/teacher">/teacher</Link></td>
            <td>본인 평가계획 작성·검증·제출</td>
          </tr>
          <tr>
            <td>평가관리자</td>
            <td><Link href="/admin/evaluation">/admin/evaluation</Link></td>
            <td>전 교과 작성현황·검토·취합</td>
          </tr>
          <tr>
            <td>학교관리자</td>
            <td><Link href="/admin/school">/admin/school</Link></td>
            <td>계정·권한·학교 기본설정</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
