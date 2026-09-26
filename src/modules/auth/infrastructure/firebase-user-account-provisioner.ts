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
import { FieldValue } from "firebase-admin/firestore";

import { createPasswordCredential, createTemporaryPassword } from "./password-credential";
import {
  decryptTemporaryPassword,
  encryptTemporaryPassword,
  isTemporaryPasswordDeliveryExpired,
  parseEncryptedTemporaryPassword,
} from "./temporary-password-delivery";

const USER_ACCOUNT_COUNTER_DOCUMENT = "userAccounts";

export class TeacherAccountNotFoundError extends Error {
  constructor() {
    super("사용자 계정을 찾을 수 없습니다.");
    this.name = "TeacherAccountNotFoundError";
  }
}

export class TeacherAccountPasswordConflictError extends Error {
  constructor() {
    super("계정 정보가 변경되었습니다. 사용자 목록을 새로고침한 뒤 다시 확인해 주세요.");
    this.name = "TeacherAccountPasswordConflictError";
  }
}

export class TeacherAccountSubjectUnavailableError extends Error {
  constructor() {
    super("과목 분류 상태가 변경되었습니다. 작성 대상 과목을 다시 선택해 주세요.");
    this.name = "TeacherAccountSubjectUnavailableError";
  }
}

export class FirebaseUserAccountProvisioner implements UserAccountProvisioner {
  async provision(command: ProvisionUserCommand): Promise<ProvisionedUser> {
    const temporaryPassword = createTemporaryPassword();
    const passwordCredential = await createPasswordCredential(temporaryPassword);
    const temporaryPasswordDelivery = encryptTemporaryPassword(temporaryPassword, 1);
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

    const userDocument = database.collection("users").doc(authUser.uid);
    try {
      const userData = {
        schoolId: command.schoolId,
        displayName: command.displayName,
        ...(command.subjectLabel ? { subjectLabel: command.subjectLabel } : {}),
        ...(command.subjectId ? { subjectId: command.subjectId } : {}),
        teachingGrades: command.teachingGrades,
        role: command.role,
        active: true,
        passwordCredential,
        temporaryPasswordDelivery,
        mustChangePassword: true,
        failedLoginAttempts: 0,
        loginLockedUntil: 0,
      };
      await database.runTransaction(async (transaction) => {
        if (command.subjectId) {
          const subjectDocument = database.collection("schools").doc(command.schoolId)
            .collection("subjects").doc(command.subjectId);
          const subjectSnapshot = await transaction.get(subjectDocument);
          if (!subjectSnapshot.exists || subjectSnapshot.data()?.activeForPlans !== true) {
            throw new TeacherAccountSubjectUnavailableError();
          }
        }
        transaction.create(userDocument, userData);
      });

    } catch (error) {
      await auth.deleteUser(authUser.uid).catch(() => undefined);
      throw error;
    }

    const createdProfile = await userDocument.get();
    const currentProfile = parseUserProfile(authUser.uid, createdProfile.data());
    const currentDelivery = parseEncryptedTemporaryPassword(createdProfile.data()?.temporaryPasswordDelivery);
    if (!currentProfile?.active || !currentProfile.mustChangePassword || !currentDelivery
      || decryptTemporaryPassword(currentDelivery) !== temporaryPassword) {
      throw new TeacherAccountPasswordConflictError();
    }
    return { userId: authUser.uid, loginIdentifier, temporaryPassword };
  }

  async resetPassword(command: ResetUserPasswordCommand): Promise<ResetUserPasswordResult> {
    const database = getFirebaseAdminDatabase();
    const userDocument = database.collection("users").doc(command.userId);
    const temporaryPassword = createTemporaryPassword();
    const passwordCredential = await createPasswordCredential(temporaryPassword);
    let issuedRevision = 0;
    await database.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(userDocument);
      const data = snapshot.data();
      const profile = parseUserProfile(command.userId, data);
      if (!profile || !profile.active || profile.schoolId !== command.schoolId || profile.role !== "teacher") {
        throw new TeacherAccountNotFoundError();
      }
      const currentDelivery = parseEncryptedTemporaryPassword(data?.temporaryPasswordDelivery);
      const revision = currentDelivery ? currentDelivery.revision + 1 : 1;
      issuedRevision = revision;
      transaction.update(userDocument, {
        passwordCredential,
        temporaryPasswordDelivery: encryptTemporaryPassword(temporaryPassword, revision),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        loginLockedUntil: 0,
      });
    });
    await getFirebaseAdminAuth().revokeRefreshTokens(command.userId);

    const currentSnapshot = await userDocument.get();
    const currentData = currentSnapshot.data();
    const currentProfile = parseUserProfile(command.userId, currentData);
    const currentDelivery = parseEncryptedTemporaryPassword(currentData?.temporaryPasswordDelivery);
    if (!currentProfile?.active || !currentProfile.mustChangePassword || !currentDelivery
      || currentDelivery.revision !== issuedRevision
      || decryptTemporaryPassword(currentDelivery) !== temporaryPassword) {
      throw new TeacherAccountPasswordConflictError();
    }

    return { temporaryPassword };
  }
}

export async function listSchoolTeacherAccounts(
  schoolId: string,
  userIds?: readonly string[],
): Promise<TeacherAccountSummary[]> {
  const userCollection = getFirebaseAdminDatabase().collection("users");
  const documents = userIds
    ? await Promise.all([...new Set(userIds)].map((userId) => userCollection.doc(userId).get()))
    : (await userCollection.where("schoolId", "==", schoolId).get()).docs;

  const users: TeacherAccountSummary[] = [];
  for (const document of documents) {
    let data = document.data() ?? {};
    let profile = parseUserProfile(document.id, data);
    if (profile?.role !== "teacher" || profile.schoolId !== schoolId) continue;
    let passwordDelivery = summarizePasswordDelivery(profile.mustChangePassword, profile.active, data.temporaryPasswordDelivery);
    if (passwordDelivery.temporaryPasswordState === "available") {
      const currentSnapshot = await document.ref.get();
      data = currentSnapshot.data() ?? {};
      profile = parseUserProfile(document.id, data);
      if (profile?.role !== "teacher" || profile.schoolId !== schoolId) continue;
      passwordDelivery = summarizePasswordDelivery(profile.mustChangePassword, profile.active, data.temporaryPasswordDelivery);
    }
    users.push({
      id: profile.id,
      loginIdentifier: profile.id,
      displayName: profile.displayName,
      subjectLabel: profile.subjectLabel ?? "",
      subjectId: profile.subjectId,
      teachingGrades: profile.teachingGrades,
      active: profile.active,
      mustChangePassword: profile.mustChangePassword,
      ...passwordDelivery,
    });
  }

  return users
    .sort((left, right) => left.loginIdentifier.localeCompare(right.loginIdentifier));
}

export async function getSchoolTeacherSubjectId(schoolId: string, userId: string): Promise<string | undefined> {
  const snapshot = await getFirebaseAdminDatabase().collection("users").doc(userId).get();
  const profile = parseUserProfile(userId, snapshot.data());
  if (!profile || profile.schoolId !== schoolId || profile.role !== "teacher") {
    throw new TeacherAccountNotFoundError();
  }
  return profile.subjectId;
}

export async function updateSchoolTeacherAccount(params: {
  schoolId: string;
  userId: string;
  displayName: string;
  subjectLabel?: string;
  subjectId?: string;
  teachingGrades: UserProfile["teachingGrades"];
  active: boolean;
}): Promise<TeacherAccountSummary> {
  const database = getFirebaseAdminDatabase();
  const userDocument = database.collection("users").doc(params.userId);
  const result = await database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userDocument);
    const data = snapshot.data();
    const profile = parseUserProfile(params.userId, data);
    if (!profile || profile.schoolId !== params.schoolId || profile.role !== "teacher") {
      throw new TeacherAccountNotFoundError();
    }

    if (params.subjectId && params.subjectId !== profile.subjectId) {
      const subjectDocument = database.collection("schools").doc(params.schoolId)
        .collection("subjects").doc(params.subjectId);
      const subjectSnapshot = await transaction.get(subjectDocument);
      if (!subjectSnapshot.exists || subjectSnapshot.data()?.activeForPlans !== true) {
        throw new TeacherAccountSubjectUnavailableError();
      }
    }

    const patch = {
      displayName: params.displayName,
      ...(params.subjectLabel !== undefined ? { subjectLabel: params.subjectLabel } : {}),
      ...(params.subjectId ? { subjectId: params.subjectId } : {}),
      teachingGrades: params.teachingGrades,
      active: params.active,
      ...(!params.active ? { temporaryPasswordDelivery: FieldValue.delete() } : {}),
    };
    transaction.update(userDocument, patch);
    const nextProfile = parseUserProfile(params.userId, { ...data, ...patch, active: params.active });
    if (!nextProfile) throw new TeacherAccountNotFoundError();
    return { wasActive: profile.active };
  });

  if (result.wasActive !== params.active) {
    await getFirebaseAdminAuth().updateUser(params.userId, { disabled: !params.active });
    if (!params.active) await getFirebaseAdminAuth().revokeRefreshTokens(params.userId);
  }

  const currentSnapshot = await userDocument.get();
  const currentData = currentSnapshot.data();
  const currentProfile = parseUserProfile(params.userId, currentData);
  if (!currentProfile || currentProfile.schoolId !== params.schoolId || currentProfile.role !== "teacher") {
    throw new TeacherAccountNotFoundError();
  }
  return {
    id: currentProfile.id,
    loginIdentifier: currentProfile.id,
    displayName: currentProfile.displayName,
    subjectLabel: currentProfile.subjectLabel ?? "",
    subjectId: currentProfile.subjectId,
    teachingGrades: currentProfile.teachingGrades,
    active: currentProfile.active,
    mustChangePassword: currentProfile.mustChangePassword,
    ...summarizePasswordDelivery(
      currentProfile.mustChangePassword,
      currentProfile.active,
      currentData?.temporaryPasswordDelivery,
    ),
  };
}

function summarizePasswordDelivery(
  mustChangePassword: boolean,
  active: boolean,
  rawDelivery: unknown,
): Pick<TeacherAccountSummary, "temporaryPasswordState" | "temporaryPassword"> {
  if (!mustChangePassword) return { temporaryPasswordState: "changed" };
  if (!active) return { temporaryPasswordState: "unavailable" };
  const delivery = parseEncryptedTemporaryPassword(rawDelivery);
  if (!delivery) return { temporaryPasswordState: "unavailable" };
  if (isTemporaryPasswordDeliveryExpired(delivery)) return { temporaryPasswordState: "expired" };
  const temporaryPassword = decryptTemporaryPassword(delivery);
  return temporaryPassword
    ? { temporaryPasswordState: "available", temporaryPassword }
    : { temporaryPasswordState: "unavailable" };
}

function readLastAccountNumber(value: FirebaseFirestore.DocumentData | undefined): number {
  if (!value || !Number.isInteger(value.lastNumber) || value.lastNumber < 0) return 0;
  return value.lastNumber;
}
