"use client";

import { onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { isAuthenticationDisabled } from "../application/authentication-mode";
import type { UserProfile } from "../domain/user-profile";
import { authenticatedFetch } from "../infrastructure/authenticated-fetch";
import { getFirebaseClientAuth } from "@/shared/firebase/client";
import { AppNavigation } from "@/app/_components/AppNavigation";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "error"; message: string }
  | { status: "signed-in"; profile: UserProfile };

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const authenticationDisabled = isAuthenticationDisabled();

  useEffect(() => {
    let cancelled = false;
    let requestRevision = 0;

    async function loadSession() {
      const currentRevision = ++requestRevision;
      try {
        const response = await authenticatedFetch("/api/auth/session", { cache: "no-store" });
        if (response.status === 401) {
          if (!cancelled && currentRevision === requestRevision) setState({ status: "signed-out" });
          return;
        }
        const body = await response.json() as { profile?: UserProfile; error?: string };
        if (!response.ok || !body.profile) throw new Error(body.error ?? "로그인 정보를 확인하지 못했습니다.");
        if (!cancelled && currentRevision === requestRevision) setState({ status: "signed-in", profile: body.profile });
      } catch (error) {
        if (!cancelled && currentRevision === requestRevision) setState({
          status: "error",
          message: error instanceof Error ? error.message : "로그인 정보를 확인하지 못했습니다.",
        });
      }
    }

    function reloadProfile() {
      if (!authenticationDisabled && !getFirebaseClientAuth().currentUser) return;
      setState({ status: "loading" });
      void loadSession();
    }

    if (authenticationDisabled) {
      void loadSession();
    }

    const unsubscribe = authenticationDisabled ? undefined : onAuthStateChanged(getFirebaseClientAuth(), (user) => {
      if (!user) {
        requestRevision += 1;
        setState({ status: "signed-out" });
        return;
      }
      setState({ status: "loading" });
      void loadSession();
    });
    window.addEventListener("auth-profile-updated", reloadProfile);
    return () => {
      cancelled = true;
      unsubscribe?.();
      window.removeEventListener("auth-profile-updated", reloadProfile);
    };
  }, [authenticationDisabled]);

  useEffect(() => {
    if (state.status === "loading" || state.status === "error") return;

    const isEntry = pathname === "/" || pathname === "/login";
    const isTeacherPath = pathname.startsWith("/teacher");
    const isAdminPath = pathname.startsWith("/admin/evaluation");
    const isAccountPath = pathname.startsWith("/account");

    if (state.status === "signed-out") {
      if (isTeacherPath || isAdminPath || isAccountPath) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      }
      return;
    }

    const { profile } = state;
    const landing = profile.role === "evaluation_admin" ? "/admin/evaluation" : "/teacher/evaluation-plan";
    if (profile.mustChangePassword && pathname !== "/account/password") {
      router.replace(`/account/password?next=${encodeURIComponent(landing)}`);
      return;
    }
    if (isEntry) {
      router.replace(landing);
      return;
    }
    if (pathname === "/teacher") {
      const hasAssignment = Boolean(profile.subjectId || profile.subjectLabel) && profile.teachingGrades.length > 0;
      router.replace(profile.role === "evaluation_admin" && !hasAssignment
        ? "/teacher/evaluation-plan?preview=1"
        : "/teacher/evaluation-plan");
      return;
    }
    if (isAdminPath && profile.role !== "evaluation_admin") {
      router.replace(landing);
      return;
    }
    if (isAccountPath && !pathname.startsWith("/account/password")) {
      router.replace(landing);
    }
  }, [pathname, router, state]);

  if (state.status === "loading") {
    return <main className="login-page"><p className="muted" role="status">로그인 정보를 확인하고 있습니다.</p></main>;
  }
  if (state.status === "error") {
    return <main className="login-page"><p className="validation-error-box" role="alert">{state.message}</p></main>;
  }

  const profile = state.status === "signed-in" ? state.profile : null;
  const isEntry = pathname === "/" || pathname === "/login";
  const blockedSignedOutPath = state.status === "signed-out"
    && (pathname.startsWith("/teacher") || pathname.startsWith("/admin/evaluation") || pathname.startsWith("/account"));
  const blockedRolePath = profile && pathname.startsWith("/admin/evaluation") && profile.role !== "evaluation_admin";
  const blockedEntry = profile && isEntry;
  const blockedPasswordPath = profile?.mustChangePassword && !pathname.startsWith("/account/password");

  if (blockedSignedOutPath || blockedRolePath || blockedEntry || blockedPasswordPath) return null;

  return <>
    {profile?.role === "evaluation_admin" && !profile.mustChangePassword ? <AppNavigation profile={profile} /> : null}
    {children}
  </>;
}
