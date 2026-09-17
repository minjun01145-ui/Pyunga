"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";

import { isAuthenticationDisabled } from "@/modules/auth";
import { getFirebaseClientAuth } from "@/shared/firebase/client";

export function AuthNavigation() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const authenticationDisabled = isAuthenticationDisabled();

  useEffect(() => {
    if (authenticationDisabled) return;
    return onAuthStateChanged(getFirebaseClientAuth(), setUser);
  }, [authenticationDisabled]);

  if (authenticationDisabled) return <span className="muted">개발 중 · 로그인 생략</span>;

  if (user === undefined) return null;
  if (!user) return <Link href="/login">로그인</Link>;

  return (
    <button className="text-button auth-sign-out" type="button" onClick={() => signOut(getFirebaseClientAuth())}>
      로그아웃
    </button>
  );
}
