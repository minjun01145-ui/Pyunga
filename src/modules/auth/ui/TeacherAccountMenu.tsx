"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";

import { getFirebaseClientAuth } from "@/shared/firebase/client";

export function TeacherAccountMenu() {
  return (
    <nav className="teacher-account-menu" aria-label="계정 메뉴">
      <Link href="/account/password">비밀번호 변경</Link>
      <button className="text-button" type="button" onClick={() => void signOut(getFirebaseClientAuth())}>
        로그아웃
      </button>
    </nav>
  );
}
