"use client";

import { getFirebaseClientAuth } from "@/shared/firebase/client";

import { isAuthenticationDisabled } from "../application/authentication-mode";

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  if (isAuthenticationDisabled()) {
    return fetch(input, init);
  }

  const user = getFirebaseClientAuth().currentUser;
  if (!user) {
    throw new Error("로그인 후 이용해 주세요.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);

  return fetch(input, { ...init, headers });
}
