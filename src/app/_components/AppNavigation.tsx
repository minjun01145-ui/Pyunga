"use client";

import { signOut } from "firebase/auth";
import Link from "next/link";

import type { UserProfile } from "@/modules/auth";
import { getFirebaseClientAuth } from "@/shared/firebase/client";

export function AppNavigation({ profile }: { profile: UserProfile }) {
  const hasAssignment = Boolean(profile.subjectId || profile.subjectLabel) && profile.teachingGrades.length > 0;
  return (
    <nav className="simple-nav app-navigation" aria-label="평가계 메뉴">
      <Link className="app-name" href="/admin/evaluation">평가계</Link>
      <div className="app-navigation-links">
        <Link href={hasAssignment ? "/teacher/evaluation-plan" : "/teacher/evaluation-plan?preview=1"}>
          과목 교사용 화면 보기
        </Link>
        <Link href="/admin/evaluation/template/presentation">평가계용 설정</Link>
      </div>
      <div className="app-navigation-auth">
        <span>{profile.displayName}</span>
        <Link href="/account/password">비밀번호 변경</Link>
        <button className="text-button auth-sign-out" type="button" onClick={() => void signOut(getFirebaseClientAuth())}>
          로그아웃
        </button>
      </div>
    </nav>
  );
}
