import { parseUserProfile } from "@/modules/auth";
import { getFirebaseAdminAuth, getFirebaseAdminDatabase } from "@/shared/firebase/admin";

import {
  createPasswordCredential,
  parseStoredPasswordCredential,
  verifyPasswordCredential,
} from "./password-credential";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 5 * 60 * 1000;

export class InvalidLoginError extends Error {
  constructor() {
    super("아이디 또는 비밀번호를 확인해 주세요.");
    this.name = "InvalidLoginError";
  }
}

export class PasswordChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PasswordChangeError";
  }
}

export async function authenticateUserLogin(params: {
  loginIdentifier: string;
  password: string;
}): Promise<{ customToken: string; mustChangePassword: boolean }> {
  const database = getFirebaseAdminDatabase();
  const identifier = normalizeLoginIdentifier(params.loginIdentifier);
  const userDocument = database.collection("users").doc(identifier);
  const attempt = await reserveLoginAttempt(identifier);
  if (!attempt) {
    throw new InvalidLoginError();
  }

  if (!(await verifyPasswordCredential(params.password, attempt.credential))) {
    throw new InvalidLoginError();
  }

  await userDocument.update({
    failedLoginAttempts: 0,
    loginLockedUntil: 0,
  });

  const customToken = await getFirebaseAdminAuth().createCustomToken(attempt.profile.id);
  return { customToken, mustChangePassword: attempt.profile.mustChangePassword };
}

export async function changeUserPassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const userDocument = getFirebaseAdminDatabase().collection("users").doc(params.userId);
  const snapshot = await userDocument.get();
  const profile = parseUserProfile(params.userId, snapshot.data());
  const credential = parseStoredPasswordCredential(snapshot.data()?.passwordCredential);

  if (!profile || !profile.active || !credential) {
    throw new PasswordChangeError("사용자 계정 정보를 확인할 수 없습니다.");
  }

  if (!(await verifyPasswordCredential(params.currentPassword, credential))) {
    throw new PasswordChangeError("현재 비밀번호가 올바르지 않습니다.");
  }

  await userDocument.update({
    passwordCredential: await createPasswordCredential(params.newPassword),
    mustChangePassword: false,
    failedLoginAttempts: 0,
    loginLockedUntil: 0,
  });
}

function normalizeLoginIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

async function reserveLoginAttempt(userId: string): Promise<{
  profile: NonNullable<ReturnType<typeof parseUserProfile>>;
  credential: NonNullable<ReturnType<typeof parseStoredPasswordCredential>>;
} | null> {
  const database = getFirebaseAdminDatabase();
  const userDocument = database.collection("users").doc(userId);
  const now = Date.now();

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userDocument);
    const storedUser = snapshot.data();
    const profile = parseUserProfile(userId, storedUser);
    const credential = parseStoredPasswordCredential(storedUser?.passwordCredential);
    if (
      !profile ||
      !profile.active ||
      !credential ||
      readLoginLockedUntil(storedUser) > now
    ) {
      return null;
    }

    const nextAttempts = readFailedLoginAttempts(storedUser) + 1;
    if (nextAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      transaction.update(userDocument, {
        failedLoginAttempts: nextAttempts,
        loginLockedUntil: now + LOGIN_LOCK_DURATION_MS,
      });
    } else {
      transaction.update(userDocument, {
        failedLoginAttempts: nextAttempts,
        loginLockedUntil: 0,
      });
    }

    return { profile, credential };
  });
}

function readFailedLoginAttempts(value: FirebaseFirestore.DocumentData | undefined): number {
  return value && Number.isInteger(value.failedLoginAttempts) && value.failedLoginAttempts >= 0
    ? value.failedLoginAttempts
    : 0;
}

function readLoginLockedUntil(value: FirebaseFirestore.DocumentData | undefined): number {
  return value && typeof value.loginLockedUntil === "number" && Number.isFinite(value.loginLockedUntil)
    ? value.loginLockedUntil
    : 0;
}
