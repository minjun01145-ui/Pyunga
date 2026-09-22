"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { getFirebaseClientAuth } from "@/shared/firebase/client";

export function PasswordChangeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => onAuthStateChanged(getFirebaseClientAuth(), setUser), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호가 서로 다릅니다.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "비밀번호를 변경하지 못했습니다.");
      }

      router.replace(safeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (user === undefined) {
    return <p className="muted">로그인 정보를 확인하고 있습니다.</p>;
  }

  if (!user) {
    return <p className="notice">로그인 후 비밀번호를 변경할 수 있습니다. <Link href="/login">로그인</Link></p>;
  }

  return (
    <form className="login-form panel" onSubmit={handleSubmit}>
      <label className="field">
        <span>현재 비밀번호</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </label>
      <label className="field">
        <span>새 비밀번호</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={64}
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </label>
      <label className="field">
        <span>새 비밀번호 확인</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={6}
          maxLength={64}
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>
      <p className="muted small-copy">새 비밀번호는 6자 이상으로 입력해 주세요.</p>
      {error ? <p className="validation-error-box">{error}</p> : null}
      <button className="secondary-button align-start" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "변경 중" : "비밀번호 변경"}
      </button>
    </form>
  );
}

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}
