import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1 className="page-title">평가계획 작성기</h1>
      <p className="muted">중학교 교과별 교수·학습 및 평가계획 작성·검증 도구</p>

      <h2 className="section-title">업무 화면</h2>
      <table className="simple-table">
        <thead>
          <tr>
            <th>구분</th>
            <th>주요 기능</th>
            <th>바로가기</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>과목교사</td>
            <td>본인 평가계획 작성·검증·제출</td>
            <td><Link href="/teacher">열기</Link></td>
          </tr>
          <tr>
            <td>평가계</td>
            <td>전 교과 작성 현황·검토·취합</td>
            <td><Link href="/admin/evaluation">열기</Link></td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
