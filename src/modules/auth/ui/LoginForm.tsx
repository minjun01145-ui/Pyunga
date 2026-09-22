"use client";

import { signInWithCustomToken } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getFirebaseClientAuth } from "@/shared/firebase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginIdentifier, password }),
      });
      const body = (await response.json().catch(() => null)) as
        | { customToken?: string; mustChangePassword?: boolean; error?: string }
        | null;
      if (!response.ok || !body?.customToken) {
        throw new Error(body?.error ?? "아이디 또는 비밀번호를 확인해 주세요.");
      }

      await signInWithCustomToken(getFirebaseClientAuth(), body.customToken);
      const nextPath = safeNextPath(searchParams.get("next"));
      router.replace(
        body.mustChangePassword
          ? `/account/password?next=${encodeURIComponent(nextPath)}`
          : nextPath,
      );
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "로그인에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form panel" onSubmit={handleSubmit}>
      <label className="field">
        <span>아이디</span>
        <input
          type="text"
          autoComplete="username"
          required
          value={loginIdentifier}
          onChange={(event) => setLoginIdentifier(event.target.value)}
        />
      </label>
      <label className="field">
        <span>비밀번호</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="validation-error-box">{error}</p> : null}
      <button className="secondary-button align-start" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "로그인 중" : "로그인"}
      </button>
    </form>
  );
}

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
