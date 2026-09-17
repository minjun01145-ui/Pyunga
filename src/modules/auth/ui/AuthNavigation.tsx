"use client";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getFirebaseClientAuth } from "@/shared/firebase/client";

export function AuthNavigation() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(getFirebaseClientAuth(), setUser), []);

  if (user === undefined) return null;
  if (!user) return <Link href="/login">로그인</Link>;

  return (
    <button className="text-button auth-sign-out" type="button" onClick={() => signOut(getFirebaseClientAuth())}>
      로그아웃
    </button>
  );
}
