import {
  parseUserProfile,
  type ProvisionedUser,
  type ProvisionUserCommand,
  type ResetUserPasswordCommand,
  type ResetUserPasswordResult,
  type TeacherAccountSummary,
  type UserAccountProvisioner,
  type UserProfile,
} from "@/modules/auth";
import { getFirebaseAdminAuth, getFirebaseAdminDatabase } from "@/shared/firebase/admin";

import { createPasswordCredential, createTemporaryPassword } from "./password-credential";

const USER_ACCOUNT_COUNTER_DOCUMENT = "userAccounts";

export class TeacherAccountNotFoundError extends Error {
  constructor() {
    super("사용자 계정을 찾을 수 없습니다.");
    this.name = "TeacherAccountNotFoundError";
  }
}

export class FirebaseUserAccountProvisioner implements UserAccountProvisioner {
  async provision(command: ProvisionUserCommand): Promise<ProvisionedUser> {
    const temporaryPassword = createTemporaryPassword();
    const passwordCredential = await createPasswordCredential(temporaryPassword);
    const auth = getFirebaseAdminAuth();
    const database = getFirebaseAdminDatabase();
    const loginIdentifier = await database.runTransaction(async (transaction) => {
      const counterDocument = database.collection("system").doc(USER_ACCOUNT_COUNTER_DOCUMENT);
      const counterSnapshot = await transaction.get(counterDocument);
      const lastNumber = readLastAccountNumber(counterSnapshot.data());
      const nextNumber = lastNumber + 1;
      transaction.set(counterDocument, { lastNumber: nextNumber }, { merge: true });
      return `user${String(nextNumber).padStart(4, "0")}`;
    });
    const authUser = await auth.createUser({
      uid: loginIdentifier,
      displayName: command.displayName,
    });

    try {
      await database.collection("users").doc(authUser.uid).create({
        schoolId: command.schoolId,
        displayName: command.displayName,
        subjectLabel: command.subjectLabel,
        teachingGrades: command.teachingGrades,
        role: command.role,
        active: true,
        passwordCredential,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        loginLockedUntil: 0,
      });

      return {
        userId: authUser.uid,
        loginIdentifier,
        temporaryPassword,
      };
    } catch (error) {
      await auth.deleteUser(authUser.uid).catch(() => undefined);
      throw error;
    }
  }

  async resetPassword(command: ResetUserPasswordCommand): Promise<ResetUserPasswordResult> {
    const database = getFirebaseAdminDatabase();
    const userDocument = database.collection("users").doc(command.userId);
    const snapshot = await userDocument.get();
    const profile = parseUserProfile(command.userId, snapshot.data());

    if (!profile || profile.schoolId !== command.schoolId || profile.role !== "teacher") {
      throw new TeacherAccountNotFoundError();
    }

    const temporaryPassword = createTemporaryPassword();
    const passwordCredential = await createPasswordCredential(temporaryPassword);
    await getFirebaseAdminAuth().revokeRefreshTokens(command.userId);
    await userDocument.update({
      passwordCredential,
      mustChangePassword: true,
      failedLoginAttempts: 0,
      loginLockedUntil: 0,
    });

    return { temporaryPassword };
  }
}

export async function listSchoolTeacherAccounts(schoolId: string): Promise<TeacherAccountSummary[]> {
  const snapshot = await getFirebaseAdminDatabase()
    .collection("users")
    .where("schoolId", "==", schoolId)
    .get();

  return snapshot.docs
    .map((document) => parseUserProfile(document.id, document.data()))
    .filter((profile): profile is UserProfile => profile?.role === "teacher")
    .map((profile) => ({
      id: profile.id,
      loginIdentifier: profile.id,
      displayName: profile.displayName,
      subjectLabel: profile.subjectLabel ?? "",
      teachingGrades: profile.teachingGrades,
      active: profile.active,
      mustChangePassword: profile.mustChangePassword,
    }))
    .sort((left, right) => left.loginIdentifier.localeCompare(right.loginIdentifier));
}

function readLastAccountNumber(value: FirebaseFirestore.DocumentData | undefined): number {
  if (!value || !Number.isInteger(value.lastNumber) || value.lastNumber < 0) return 0;
  return value.lastNumber;
}
