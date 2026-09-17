import { Suspense } from "react";

import { LoginForm } from "@/modules/auth/ui/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page">
      <h1 className="page-title">로그인</h1>
      <p className="muted">학교 관리자가 등록한 이메일 계정으로 로그인하세요.</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
