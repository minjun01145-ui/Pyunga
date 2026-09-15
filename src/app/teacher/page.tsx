import Link from "next/link";

export default function TeacherPage() {
  return (
    <main>
      <h1 className="page-title">내 평가계획</h1>
      <p className="muted">2027학년도 1학기</p>

      <table className="simple-table">
        <thead>
          <tr>
            <th>학년도</th>
            <th>학기</th>
            <th>학년</th>
            <th>교과</th>
            <th>상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2027</td>
            <td>1학기</td>
            <td>3학년</td>
            <td>영어</td>
            <td>작성 전</td>
            <td><Link href="/teacher/performance-prototype">수행평가 작성</Link></td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}
