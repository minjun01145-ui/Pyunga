"use client";

import { getFirebaseClientAuth } from "./client";

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const user = getFirebaseClientAuth().currentUser;
  if (!user) {
    throw new Error("로그인 후 이용해 주세요.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await user.getIdToken()}`);

  return fetch(input, { ...init, headers });
}
