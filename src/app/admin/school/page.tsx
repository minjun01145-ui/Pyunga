export default function SchoolAdminPage() {
  return (
    <main>
      <h1 className="page-title">학교 시스템 관리</h1>
      <p className="muted">학교관리자용 골격 화면입니다. 실제 계정 발급은 아직 구현하지 않았습니다.</p>

      <div className="notice">
        계정 생성과 역할 변경은 향후 서버의 권한 검증을 거쳐 Firebase Admin SDK로 처리합니다.
      </div>
    </main>
  );
}
