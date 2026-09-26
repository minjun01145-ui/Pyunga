import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserProfile } from "@/modules/auth";
import { createDefaultEvaluationTemplate } from "@/modules/template";
import { createEmptyEvaluationPlanDraft } from "../application/evaluation-plan-draft";
import type { TeacherEvaluationContext } from "../application/teacher-evaluation-context";

const firebase = vi.hoisted(() => ({
  current: undefined as Record<string, unknown> | undefined,
  templateRevision: 3,
  writes: 0,
}));

vi.mock("@/shared/firebase/admin", () => {
  function createCollection(path: string) {
    return {
      doc(id: string) {
        const documentPath = `${path}/${id}`;
        return {
          id,
          path: documentPath,
          collection: (name: string) => createCollection(`${documentPath}/${name}`),
        };
      },
    };
  }

  const database = {
    collection: (name: string) => createCollection(name),
    runTransaction: async <T>(work: (transaction: {
      get: (reference: { path: string }) => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
      set: (reference: { path: string }, value: Record<string, unknown>) => void;
    }) => Promise<T>) => work({
      get: async (reference) => {
        if (reference.path.endsWith("/evaluationTemplates/current")) {
          return { exists: true, data: () => ({ revision: firebase.templateRevision }) };
        }
        return {
          exists: firebase.current !== undefined,
          data: () => firebase.current,
        };
      },
      set: (_reference, value) => {
        firebase.current = value;
        firebase.writes += 1;
      },
    }),
  };

  return { getFirebaseAdminDatabase: () => database };
});

import { evaluationPlanDocumentId, evaluationPlanDraftStorageScope, writeEvaluationPlan } from "./firestore-evaluation-plan";

const profile: UserProfile = {
  id: "teacher-1",
  schoolId: "school-1",
  displayName: "교사",
  subjectLabel: "영어",
  teachingGrades: [1],
  role: "teacher",
  active: true,
  mustChangePassword: false,
};
const context: TeacherEvaluationContext = {
  academicYear: 2026,
  semester: 2,
  grade: 1,
  subjectLabel: "영어",
};

describe("Firestore evaluation plan drafts", () => {
  beforeEach(() => {
    firebase.current = undefined;
    firebase.templateRevision = 3;
    firebase.writes = 0;
  });

  it("uses separate document and local-storage scopes for each teacher and school context", () => {
    expect(evaluationPlanDocumentId("teacher-1", context)).not.toBe(evaluationPlanDocumentId("teacher-2", context));
    expect(evaluationPlanDocumentId("teacher-1", context)).not.toBe(evaluationPlanDocumentId("teacher-1", { ...context, grade: 2 }));
    expect(evaluationPlanDraftStorageScope("school-1", "teacher-1")).not.toBe(evaluationPlanDraftStorageScope("school-2", "teacher-1"));
    expect(evaluationPlanDraftStorageScope("school-1", "teacher-1")).not.toBe(evaluationPlanDraftStorageScope("school-1", "teacher-2"));
  });

  it("does not write a server document when a draft save matches the last saved content", async () => {
    const draft = {
      ...createEmptyEvaluationPlanDraft(context),
      sections: { method: { fields: { description: "과정 중심으로 평가한다." } } },
    };
    const template = createDefaultEvaluationTemplate();
    const first = await writeEvaluationPlan({
      profile,
      context,
      draft,
      template,
      templateRevision: firebase.templateRevision,
      calendarEvents: [],
      expectedRevision: 0,
      action: "save",
    });
    const duplicate = await writeEvaluationPlan({
      profile,
      context,
      draft,
      template,
      templateRevision: firebase.templateRevision,
      calendarEvents: [],
      expectedRevision: first.revision,
      action: "save",
    });

    expect(firebase.writes).toBe(1);
    expect(duplicate.revision).toBe(first.revision);
    expect(duplicate.updatedAt).toBe(first.updatedAt);
  });
});
