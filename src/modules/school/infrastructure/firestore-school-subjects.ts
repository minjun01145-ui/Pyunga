import { createHash, randomUUID } from "node:crypto";

import { parseUserProfile } from "@/modules/auth";
import { getFirebaseAdminDatabase } from "@/shared/firebase/admin";

import { normalizeSubjectName, validateSubjectName, type SchoolSubject } from "../domain/subject";

export class SchoolSubjectNotFoundError extends Error {
  constructor() {
    super("과목 분류를 찾을 수 없습니다.");
    this.name = "SchoolSubjectNotFoundError";
  }
}

export class SchoolSubjectConflictError extends Error {
  constructor(message = "같은 이름의 과목 분류가 이미 있습니다.") {
    super(message);
    this.name = "SchoolSubjectConflictError";
  }
}

export class SchoolSubjectRevisionConflictError extends Error {
  constructor() {
    super("다른 화면에서 과목 분류가 변경되었습니다. 최신 내용을 다시 불러와 주세요.");
    this.name = "SchoolSubjectRevisionConflictError";
  }
}

function subjects(schoolId: string) {
  return getFirebaseAdminDatabase().collection("schools").doc(schoolId).collection("subjects");
}

export async function listSchoolSubjects(schoolId: string): Promise<SchoolSubject[]> {
  await adoptLegacyTeacherSubjects(schoolId);
  const snapshot = await subjects(schoolId).get();
  return snapshot.docs
    .map((document) => parseSchoolSubject(document.id, document.data()))
    .filter((subject): subject is SchoolSubject => subject !== null)
    .sort((left, right) => Number(right.activeForPlans) - Number(left.activeForPlans)
      || left.name.localeCompare(right.name, "ko"));
}

export async function getSchoolSubject(schoolId: string, subjectId: string): Promise<SchoolSubject | null> {
  const snapshot = await subjects(schoolId).doc(subjectId).get();
  return snapshot.exists ? parseSchoolSubject(snapshot.id, snapshot.data()) : null;
}

export async function getTeacherSchoolSubjectAssignment(schoolId: string, userId: string): Promise<{
  subject: SchoolSubject;
  legacySubjectLabel?: string;
} | null> {
  const database = getFirebaseAdminDatabase();
  const userReference = database.collection("users").doc(userId);
  let userSnapshot = await userReference.get();
  let profile = parseUserProfile(userId, userSnapshot.data());
  if (!profile || profile.schoolId !== schoolId || profile.role !== "teacher") return null;

  if (!profile.subjectId && profile.subjectLabel) {
    const name = normalizeSubjectName(profile.subjectLabel);
    if (name && !validateSubjectName(name)) {
      await adoptLegacyTeacherSubject(schoolId, userId, name);
      userSnapshot = await userReference.get();
      profile = parseUserProfile(userId, userSnapshot.data());
    }
  }

  if (!profile?.subjectId) return null;
  const subject = await getSchoolSubject(schoolId, profile.subjectId);
  return subject ? { subject, legacySubjectLabel: profile.subjectLabel } : null;
}

export async function createSchoolSubject(params: {
  schoolId: string;
  name: string;
}): Promise<SchoolSubject> {
  const name = normalizeSubjectName(params.name);
  const issue = validateSubjectName(name);
  if (issue) throw new SchoolSubjectConflictError(issue);
  const deterministicReference = subjects(params.schoolId).doc(subjectIdForName(name));
  const randomReference = subjects(params.schoolId).doc(randomUUID());
  const duplicateQuery = subjects(params.schoolId).where("normalizedName", "==", normalizeKey(name)).limit(1);
  const database = getFirebaseAdminDatabase();
  const now = Date.now();
  return database.runTransaction(async (transaction) => {
    const [duplicates, deterministicSnapshot] = await Promise.all([
      transaction.get(duplicateQuery),
      transaction.get(deterministicReference),
    ]);
    const existing = duplicates.docs[0] && parseSchoolSubject(duplicates.docs[0].id, duplicates.docs[0].data());
    if (existing) return existing;
    const record = { name, normalizedName: normalizeKey(name), legacyNames: [], activeForPlans: true, revision: 1, createdAt: now, updatedAt: now };
    const reference = deterministicSnapshot.exists ? randomReference : deterministicReference;
    transaction.create(reference, record);
    return { id: reference.id, name, legacyNames: [], activeForPlans: true, revision: 1, updatedAt: now };
  });
}

export async function renameSchoolSubject(params: {
  schoolId: string;
  subjectId: string;
  name: string;
  expectedRevision: number;
}): Promise<SchoolSubject> {
  const name = normalizeSubjectName(params.name);
  const issue = validateSubjectName(name);
  if (issue) throw new SchoolSubjectConflictError(issue);
  const database = getFirebaseAdminDatabase();
  const reference = subjects(params.schoolId).doc(params.subjectId);
  return database.runTransaction(async (transaction) => {
    const [snapshot, duplicate] = await Promise.all([
      transaction.get(reference),
      transaction.get(subjects(params.schoolId).where("normalizedName", "==", normalizeKey(name)).limit(2)),
    ]);
    const current = snapshot.exists ? parseSchoolSubject(snapshot.id, snapshot.data()) : null;
    if (!current) throw new SchoolSubjectNotFoundError();
    if (current.revision !== params.expectedRevision) throw new SchoolSubjectRevisionConflictError();
    if (duplicate.docs.some((document) => document.id !== current.id)) throw new SchoolSubjectConflictError();
    const updatedAt = Date.now();
    const legacyNames = [...new Set([...current.legacyNames, current.name])];
    transaction.update(reference, { name, normalizedName: normalizeKey(name), legacyNames, revision: current.revision + 1, updatedAt });
    return { ...current, name, legacyNames, revision: current.revision + 1, updatedAt };
  });
}

export async function setSchoolSubjectInclusion(params: {
  schoolId: string;
  subjectId: string;
  activeForPlans: boolean;
  expectedRevision: number;
}): Promise<{ deleted: boolean; subject?: SchoolSubject }> {
  const database = getFirebaseAdminDatabase();
  const subjectReference = subjects(params.schoolId).doc(params.subjectId);
  const userQuery = database.collection("users")
    .where("schoolId", "==", params.schoolId)
    .where("subjectId", "==", params.subjectId)
    .limit(2);
  const planCollection = database.collection("schools").doc(params.schoolId).collection("evaluationPlans");

  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(subjectReference);
    const current = snapshot.exists ? parseSchoolSubject(snapshot.id, snapshot.data()) : null;
    if (!current) throw new SchoolSubjectNotFoundError();
    if (current.revision !== params.expectedRevision) throw new SchoolSubjectRevisionConflictError();
    if (params.activeForPlans) {
      const updatedAt = Date.now();
      transaction.update(subjectReference, { activeForPlans: true, revision: current.revision + 1, updatedAt });
      return { deleted: false, subject: { ...current, activeForPlans: true, revision: current.revision + 1, updatedAt } };
    }

    const legacyNames = [...new Set([current.name, ...current.legacyNames])];
    const [userSnapshot, subjectPlans, legacyLabelPlans] = await Promise.all([
      transaction.get(userQuery),
      transaction.get(planCollection.where("context.subjectId", "==", params.subjectId).limit(1)),
      Promise.all(legacyNames.map((name) => transaction.get(planCollection.where("context.subjectLabel", "==", name).limit(1)))),
    ]);
    if (userSnapshot.docs.length === 0 && subjectPlans.docs.length === 0
      && legacyLabelPlans.every((snapshot) => snapshot.docs.length === 0)) {
      transaction.delete(subjectReference);
      return { deleted: true };
    }
    const updatedAt = Date.now();
    transaction.update(subjectReference, { activeForPlans: false, revision: current.revision + 1, updatedAt });
    return { deleted: false, subject: { ...current, activeForPlans: false, revision: current.revision + 1, updatedAt } };
  });
}

async function adoptLegacyTeacherSubjects(schoolId: string): Promise<void> {
  const database = getFirebaseAdminDatabase();
  const snapshot = await database.collection("users")
    .where("schoolId", "==", schoolId)
    .get();

  for (const userDocument of snapshot.docs) {
    const profile = parseUserProfile(userDocument.id, userDocument.data());
    if (!profile || profile.role !== "teacher" || profile.subjectId || !profile.subjectLabel) continue;
    const name = normalizeSubjectName(profile.subjectLabel);
    if (!name || validateSubjectName(name)) continue;
    await adoptLegacyTeacherSubject(schoolId, userDocument.id, name);
  }
}

async function adoptLegacyTeacherSubject(schoolId: string, userId: string, name: string): Promise<void> {
  const database = getFirebaseAdminDatabase();
  const userReference = database.collection("users").doc(userId);
  const subjectCollection = subjects(schoolId);
  const deterministicReference = subjectCollection.doc(subjectIdForName(name));
  const randomReference = subjectCollection.doc(randomUUID());
  const duplicateQuery = subjectCollection.where("normalizedName", "==", normalizeKey(name)).limit(1);

  await database.runTransaction(async (transaction) => {
    const [userSnapshot, deterministicSnapshot, duplicates] = await Promise.all([
      transaction.get(userReference),
      transaction.get(deterministicReference),
      transaction.get(duplicateQuery),
    ]);
    const profile = parseUserProfile(userId, userSnapshot.data());
    if (!profile || profile.schoolId !== schoolId || profile.role !== "teacher" || profile.subjectId
      || normalizeKey(profile.subjectLabel ?? "") !== normalizeKey(name)) return;

    const matchingDuplicate = duplicates.docs.find((document) => parseSchoolSubject(document.id, document.data()) !== null);
    const deterministicSubject = deterministicSnapshot.exists
      ? parseSchoolSubject(deterministicSnapshot.id, deterministicSnapshot.data())
      : null;
    const matchingDeterministic = deterministicSubject && normalizeKey(deterministicSubject.name) === normalizeKey(name)
      ? deterministicReference
      : null;
    const existingReference = matchingDuplicate?.ref ?? matchingDeterministic;
    const subjectReference = existingReference
      ?? (deterministicSnapshot.exists ? randomReference : deterministicReference);

    if (!existingReference) {
      const now = Date.now();
      transaction.create(subjectReference, {
        name,
        normalizedName: normalizeKey(name),
        legacyNames: [],
        activeForPlans: true,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        importedFromLegacyProfile: true,
      });
    }
    transaction.update(userReference, { subjectId: subjectReference.id });
  });
}

function parseSchoolSubject(id: string, value: unknown): SchoolSubject | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? normalizeSubjectName(record.name) : "";
  if (!name || typeof record.activeForPlans !== "boolean") return null;
  return {
    id,
    name,
    legacyNames: Array.isArray(record.legacyNames)
      ? [...new Set(record.legacyNames.filter((item): item is string => typeof item === "string").map(normalizeSubjectName).filter(Boolean))]
      : [],
    activeForPlans: record.activeForPlans,
    revision: typeof record.revision === "number" && Number.isInteger(record.revision) ? record.revision : 1,
    updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : 0,
  };
}

function subjectIdForName(name: string): string {
  return `sub_${createHash("sha256").update(normalizeKey(name)).digest("hex").slice(0, 32)}`;
}

function normalizeKey(name: string): string {
  return normalizeSubjectName(name).toLocaleLowerCase("ko-KR");
}
