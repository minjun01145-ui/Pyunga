import type { UserProfile, UserRole } from "@/modules/auth";
import { isAuthenticationDisabled, parseUserProfile } from "@/modules/auth";
import { getFirebaseAdminAuth, getFirebaseAdminDatabase } from "@/shared/firebase/admin";

export class RequestAuthenticationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 = 401,
  ) {
    super(message);
    this.name = "RequestAuthenticationError";
  }
}

export async function requireAuthenticatedProfile(
  request: Request,
  allowedRoles?: readonly UserRole[],
): Promise<UserProfile> {
  if (isAuthenticationDisabled()) {
    return developmentUserProfile();
  }

  return requireFirebaseAuthenticatedProfileWithPasswordChanged(request, allowedRoles);
}

export async function requireAuthenticatedSessionProfile(request: Request): Promise<UserProfile> {
  if (isAuthenticationDisabled()) return developmentUserProfile();
  return requireFirebaseAuthenticatedProfile(request);
}

export async function requireFirebaseAuthenticatedProfileWithPasswordChanged(
  request: Request,
  allowedRoles?: readonly UserRole[],
): Promise<UserProfile> {
  const profile = await requireFirebaseAuthenticatedProfile(request, allowedRoles);
  if (profile.mustChangePassword) {
    throw new RequestAuthenticationError("비밀번호를 먼저 변경해 주세요.", 403);
  }
  return profile;
}

export async function requireFirebaseAuthenticatedProfile(
  request: Request,
  allowedRoles?: readonly UserRole[],
): Promise<UserProfile> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new RequestAuthenticationError("로그인이 필요합니다.");
  }

  const idToken = authorization.slice("Bearer ".length).trim();
  if (!idToken) {
    throw new RequestAuthenticationError("로그인이 필요합니다.");
  }

  let uid: string;
  try {
    uid = (await getFirebaseAdminAuth().verifyIdToken(idToken, true)).uid;
  } catch {
    throw new RequestAuthenticationError("로그인 정보가 만료되었거나 올바르지 않습니다.");
  }

  const snapshot = await getFirebaseAdminDatabase().collection("users").doc(uid).get();
  if (!snapshot.exists) {
    throw new RequestAuthenticationError("사용자 프로필이 등록되지 않았습니다.", 403);
  }

  const profile = parseUserProfile(uid, snapshot.data());
  if (!profile) {
    throw new RequestAuthenticationError("사용자 프로필 데이터가 올바르지 않습니다.", 403);
  }
  if (!profile.active) {
    throw new RequestAuthenticationError("비활성화된 계정입니다.", 403);
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    throw new RequestAuthenticationError("이 작업을 수행할 권한이 없습니다.", 403);
  }

  return profile;
}

function developmentUserProfile(): UserProfile {
  return {
    id: "development-user",
    schoolId: "development-school",
    displayName: "테스트 사용자",
    teachingGrades: [1, 2, 3],
    role: "evaluation_admin",
    active: true,
    mustChangePassword: false,
  };
}
