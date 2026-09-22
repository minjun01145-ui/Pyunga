import { Suspense } from "react";

import { LoginForm } from "@/modules/auth/ui/LoginForm";

export default function LoginPage() {
  return (
    <main className="login-page">
      <h1 className="page-title">로그인</h1>
      <p className="muted">평가계에서 발급한 아이디와 비밀번호로 로그인하세요.</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
