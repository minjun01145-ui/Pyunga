import { Suspense } from "react";

import { LoginForm } from "@/modules/auth/ui/LoginForm";

export default function HomePage() {
  return (
    <main className="login-page">
      <h1 className="page-title">로그인</h1>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
