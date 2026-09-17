"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getFirebaseClientAuth } from "@/shared/firebase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(getFirebaseClientAuth(), email.trim(), password);
      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch {
      setError("이메일 또는 비밀번호를 확인해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form panel" onSubmit={handleSubmit}>
      <label className="field">
        <span>이메일</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
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
