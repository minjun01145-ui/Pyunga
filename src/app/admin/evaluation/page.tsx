export default function EvaluationAdminPage() {
  return (
    <main>
      <h1 className="page-title">평가계획 관리</h1>
      <p className="muted">2027학년도 1학기</p>

      <table className="simple-table">
        <thead>
          <tr>
            <th>교과</th>
            <th>학년</th>
            <th>담당자</th>
            <th>상태</th>
            <th>검증</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>영어</td>
            <td>3학년</td>
            <td>김OO (영어)</td>
            <td>작성 중</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
