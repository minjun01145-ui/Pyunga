import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebase = vi.hoisted(() => ({
  documents: new Map<string, Record<string, unknown>>(),
  readPaths: [] as string[],
  createUser: vi.fn(async ({ uid }: { uid: string }) => ({ uid })),
  deleteUser: vi.fn(async () => undefined),
  updateUser: vi.fn(async () => undefined),
  revokeRefreshTokens: vi.fn(async () => undefined),
}));

vi.mock("@/shared/firebase/admin", () => {
  function reference(path: string, id = path.split("/").at(-1) ?? "") {
    return {
      id,
      path,
      collection: (name: string) => ({
        doc: (childId: string) => reference(`${path}/${name}/${childId}`, childId),
      }),
      get: async () => {
        const data = firebase.documents.get(path);
        return {
          id,
          ref: reference(path, id),
          exists: data !== undefined,
          data: () => data,
        };
      },
    };
  }

  const database = {
    collection: (name: string) => ({
      doc: (id: string) => reference(`${name}/${id}`, id),
    }),
    runTransaction: async <T>(work: (transaction: {
      get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      create: (ref: { path: string }, data: Record<string, unknown>) => void;
      set: (ref: { path: string }, data: Record<string, unknown>) => void;
      update: (ref: { path: string }, data: Record<string, unknown>) => void;
    }) => Promise<T>) => work({
      get: async (ref) => {
        firebase.readPaths.push(ref.path);
        const data = firebase.documents.get(ref.path);
        return { exists: data !== undefined, data: () => data };
      },
      create: (ref, data) => {
        if (firebase.documents.has(ref.path)) throw new Error("already exists");
        firebase.documents.set(ref.path, data);
      },
      set: (ref, data) => firebase.documents.set(ref.path, data),
      update: (ref, data) => firebase.documents.set(ref.path, {
        ...firebase.documents.get(ref.path),
        ...data,
      }),
    }),
  };

  return {
    getFirebaseAdminDatabase: () => database,
    getFirebaseAdminAuth: () => ({
      createUser: firebase.createUser,
      deleteUser: firebase.deleteUser,
      updateUser: firebase.updateUser,
      revokeRefreshTokens: firebase.revokeRefreshTokens,
    }),
  };
});

import {
  FirebaseUserAccountProvisioner,
  listSchoolTeacherAccounts,
  TeacherAccountSubjectUnavailableError,
  updateSchoolTeacherAccount,
} from "./firebase-user-account-provisioner";
import { encryptTemporaryPassword } from "./temporary-password-delivery";

const encryptionKey = Buffer.alloc(32, 23);

describe("Firebase teacher accounts", () => {
  beforeEach(() => {
    firebase.documents.clear();
    firebase.readPaths = [];
    firebase.createUser.mockClear();
    firebase.deleteUser.mockClear();
    firebase.updateUser.mockClear();
    firebase.revokeRefreshTokens.mockClear();
    vi.stubEnv("PYUNGA_TEMPORARY_PASSWORD_ENCRYPTION_KEY", encryptionKey.toString("base64"));
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects an assignment when the target subject was removed after the route precheck", async () => {
    firebase.documents.set("users/teacher-1", teacherProfile("subject-old"));

    await expect(updateSchoolTeacherAccount({
      schoolId: "school-1",
      userId: "teacher-1",
      displayName: "교사",
      subjectId: "subject-removed",
      subjectLabel: "수학",
      teachingGrades: [1],
      active: true,
    })).rejects.toBeInstanceOf(TeacherAccountSubjectUnavailableError);

    expect(firebase.readPaths).toContain("schools/school-1/subjects/subject-removed");
    expect(firebase.documents.get("users/teacher-1")?.subjectId).toBe("subject-old");
  });

  it("does not read a subject when an account update keeps its current assignment", async () => {
    firebase.documents.set("users/teacher-1", teacherProfile("subject-old"));
    firebase.documents.set("schools/school-1/subjects/subject-old", { activeForPlans: false });

    await updateSchoolTeacherAccount({
      schoolId: "school-1",
      userId: "teacher-1",
      displayName: "이름 변경",
      subjectId: "subject-old",
      teachingGrades: [1],
      active: true,
    });

    expect(firebase.readPaths).toEqual(["users/teacher-1"]);
  });

  it("checks the subject inside new-account creation before writing the user", async () => {
    firebase.createUser.mockResolvedValue({ uid: "user0001" });
    firebase.documents.set("schools/school-1/subjects/subject-1", { activeForPlans: false });

    const result = await new FirebaseUserAccountProvisioner().provision({
      schoolId: "school-1",
      displayName: "새 교사",
      subjectId: "subject-1",
      subjectLabel: "국어",
      teachingGrades: [1],
      role: "teacher",
    }).then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
    expect(result).toMatchObject({ ok: false, error: { name: "TeacherAccountSubjectUnavailableError" } });

    expect(firebase.documents.has("users/user0001")).toBe(false);
    expect(firebase.deleteUser).toHaveBeenCalledWith("user0001");
  });

  it("returns only the selected users' latest temporary credentials from their own school", async () => {
    firebase.documents.set("users/teacher-1", {
      ...teacherProfile("subject-1"),
      mustChangePassword: true,
      temporaryPasswordDelivery: encryptTemporaryPassword("new-password", 2, encryptionKey),
    });
    firebase.documents.set("users/teacher-2", {
      ...teacherProfile("subject-1"),
      displayName: "선택하지 않은 교사",
      mustChangePassword: true,
      temporaryPasswordDelivery: encryptTemporaryPassword("other-password", 1, encryptionKey),
    });
    firebase.documents.set("users/foreign-teacher", {
      ...teacherProfile("subject-1", "school-2"),
      mustChangePassword: true,
      temporaryPasswordDelivery: encryptTemporaryPassword("foreign-password", 1, encryptionKey),
    });

    const users = await listSchoolTeacherAccounts("school-1", ["teacher-1", "foreign-teacher"]);

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: "teacher-1", temporaryPassword: "new-password" });
    expect(firebase.readPaths).not.toContain("users/teacher-2");
  });
});

function teacherProfile(subjectId: string, schoolId = "school-1") {
  return {
    schoolId,
    displayName: "교사",
    subjectId,
    subjectLabel: "국어",
    teachingGrades: [1],
    role: "teacher",
    active: true,
    mustChangePassword: false,
  };
}
