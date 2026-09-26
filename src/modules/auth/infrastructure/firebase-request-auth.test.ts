import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebase = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  profileData: {} as Record<string, unknown>,
}));

vi.mock("@/shared/firebase/admin", () => ({
  getFirebaseAdminAuth: () => ({ verifyIdToken: firebase.verifyIdToken }),
  getFirebaseAdminDatabase: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => firebase.profileData }),
      }),
    }),
  }),
}));

import {
  requireAuthenticatedProfile,
  requireAuthenticatedSessionProfile,
  requireFirebaseAuthenticatedProfile,
  RequestAuthenticationError,
} from "./firebase-request-auth";
import { GET as getSession } from "@/app/api/auth/session/route";

describe("request authentication with an initial password", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    firebase.verifyIdToken.mockResolvedValue({ uid: "teacher-1" });
    firebase.profileData = {
      schoolId: "school-1",
      displayName: "교사",
      teachingGrades: [1],
      role: "teacher",
      active: true,
      mustChangePassword: true,
    };
  });

  afterEach(() => vi.unstubAllEnvs());

  it("returns an authenticated profile for the session and password-change API", async () => {
    const request = new Request("https://example.test/api/auth/session", {
      headers: { authorization: "Bearer valid-token" },
    });

    const response = await getSession(request);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ profile: { mustChangePassword: true } });
    await expect(requireAuthenticatedSessionProfile(request)).resolves.toMatchObject({
      id: "teacher-1",
      mustChangePassword: true,
    });
    await expect(requireFirebaseAuthenticatedProfile(request)).resolves.toMatchObject({
      id: "teacher-1",
      mustChangePassword: true,
    });
  });

  it("continues to block protected business APIs until the password changes", async () => {
    const request = new Request("https://example.test/api/teacher/evaluation-plan", {
      headers: { authorization: "Bearer valid-token" },
    });

    await expect(requireAuthenticatedProfile(request)).rejects.toMatchObject({
      name: "RequestAuthenticationError",
      status: 403,
    } satisfies Partial<RequestAuthenticationError>);
  });
});
