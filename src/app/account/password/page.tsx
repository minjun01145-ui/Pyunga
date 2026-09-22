import { Suspense } from "react";

import { PasswordChangeForm } from "@/modules/auth/ui/PasswordChangeForm";

export default function PasswordChangePage() {
  return (
    <main className="login-page">
      <h1 className="page-title">비밀번호 변경</h1>
      <p className="muted">처음 로그인했거나 비밀번호가 초기화된 경우 새 비밀번호를 설정해 주세요.</p>
      <Suspense fallback={null}>
        <PasswordChangeForm />
      </Suspense>
    </main>
  );
}
