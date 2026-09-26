import { describe, expect, it } from "vitest";

import {
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanTemplateSignature,
} from "../application/evaluation-plan-draft";
import { createDefaultEvaluationTemplate, createDefaultEvaluationTemplateSectionConfig } from "@/modules/template";
import {
  loadEvaluationPlanWorkspaceCache,
  loadEvaluationPlanDraftEntryFromStorage,
  loadEvaluationPlanDraftBootstrap,
  loadEvaluationPlanDraftFromStorage,
  resetInvalidEvaluationPlanDraftStorage,
  saveEvaluationPlanDraftToStorage,
  saveEvaluationPlanWorkspaceCache,
  shouldUseLocalEvaluationPlanDraft,
} from "./browser-evaluation-plan-draft";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
    },
  };
}

describe("browser evaluation plan draft storage", () => {
  it("keeps drafts for different template signatures separately", () => {
    const storage = memoryStorage();
    const first = { ...createEmptyEvaluationPlanDraft(), subjectLabel: "영어" };
    const second = { ...createEmptyEvaluationPlanDraft(), subjectLabel: "수학" };

    saveEvaluationPlanDraftToStorage(storage, "v1-first", first);
    saveEvaluationPlanDraftToStorage(storage, "v1-second", second);

    expect(loadEvaluationPlanDraftFromStorage(storage, "v1-first")).toEqual({ status: "found", draft: first });
    expect(loadEvaluationPlanDraftFromStorage(storage, "v1-second")).toEqual({ status: "found", draft: second });
  });

  it("keeps local draft collections isolated by the authenticated school and teacher scope", () => {
    const storage = memoryStorage();
    const draft = { ...createEmptyEvaluationPlanDraft(), subjectLabel: "영어" };
    const schoolTeacherScope = "a".repeat(64);

    saveEvaluationPlanDraftToStorage(storage, "v1-context", draft, { storageScope: schoolTeacherScope });

    expect(loadEvaluationPlanDraftEntryFromStorage(storage, "v1-context", schoolTeacherScope)).toMatchObject({
      status: "found",
      entry: { draft },
    });
    expect(loadEvaluationPlanDraftEntryFromStorage(storage, "v1-context", "b".repeat(64))).toEqual({ status: "empty" });
  });

  it("retains server revision metadata while local edits advance their timestamp", () => {
    const storage = memoryStorage();
    const first = { ...createEmptyEvaluationPlanDraft(), subjectLabel: "영어" };
    const edited = { ...first, sections: { method: { fields: { body: "수정" } } } };
    saveEvaluationPlanDraftToStorage(storage, "v1-context", first, {
      updatedAt: "2026-09-25T01:00:00.000Z",
      serverRevisionAtSync: 4,
      serverUpdatedAtAtSync: "2026-09-25T01:00:00.000Z",
    });
    saveEvaluationPlanDraftToStorage(storage, "v1-context", edited, {
      updatedAt: "2026-09-25T01:05:00.000Z",
    });

    expect(loadEvaluationPlanDraftEntryFromStorage(storage, "v1-context")).toMatchObject({
      status: "found",
      entry: {
        draft: edited,
        updatedAt: "2026-09-25T01:05:00.000Z",
        serverRevisionAtSync: 4,
        serverUpdatedAtAtSync: "2026-09-25T01:00:00.000Z",
      },
    });
  });

  it("prefers an unsynced local draft only when its server version or timestamp is newer", () => {
    const serverDraft = createEmptyEvaluationPlanDraft();
    const localDraft = { ...serverDraft, sections: { method: { fields: { body: "local" } } } };
    const server = { draft: serverDraft, revision: 5, updatedAt: "2026-09-25T01:10:00.000Z" };

    expect(shouldUseLocalEvaluationPlanDraft({
      draft: localDraft,
      updatedAt: "2026-09-25T01:11:00.000Z",
      serverRevisionAtSync: 4,
      serverUpdatedAtAtSync: "2026-09-25T01:00:00.000Z",
    }, server)).toBe(true);
    expect(shouldUseLocalEvaluationPlanDraft({
      draft: localDraft,
      updatedAt: "2026-09-25T01:09:00.000Z",
      serverRevisionAtSync: 4,
      serverUpdatedAtAtSync: "2026-09-25T01:00:00.000Z",
    }, server)).toBe(false);
    expect(shouldUseLocalEvaluationPlanDraft({
      draft: localDraft,
      updatedAt: "2026-09-25T01:09:00.000Z",
      serverRevisionAtSync: 5,
      serverUpdatedAtAtSync: "2026-09-25T01:10:00.000Z",
    }, server)).toBe(true);
    expect(shouldUseLocalEvaluationPlanDraft({
      draft: serverDraft,
      updatedAt: "2026-09-25T01:11:00.000Z",
      serverRevisionAtSync: 4,
      serverUpdatedAtAtSync: "2026-09-25T01:00:00.000Z",
    }, server)).toBe(false);
  });

  it("caches the last validated workspace separately for each signed-in teacher", () => {
    const storage = memoryStorage();
    const workspace = {
      template: createDefaultEvaluationTemplate(),
      templateRevision: 3,
      teacherContext: {
        academicYear: 2026,
        semester: 2 as const,
        grade: 1 as const,
        subjectLabel: "영어",
      },
      calendarEvents: [],
      savedPlan: null,
      teachingGrades: [1],
      persistence: "server" as const,
      draftStorageScope: "a".repeat(64),
    };

    saveEvaluationPlanWorkspaceCache(storage, "teacher-1", workspace);

    expect(loadEvaluationPlanWorkspaceCache(storage, "teacher-1")).toMatchObject({
      templateRevision: 3,
      teacherContext: workspace.teacherContext,
      draftStorageScope: workspace.draftStorageScope,
    });
    expect(loadEvaluationPlanWorkspaceCache(storage, "teacher-2")).toBeNull();
  });

  it("does not reopen a server workspace cache without its school and teacher scope", () => {
    const storage = memoryStorage();
    const workspace = {
      template: createDefaultEvaluationTemplate(),
      templateRevision: 3,
      teacherContext: {
        academicYear: 2026,
        semester: 2 as const,
        grade: 1 as const,
        subjectLabel: "영어",
      },
      calendarEvents: [],
      savedPlan: null,
      teachingGrades: [1],
      persistence: "server" as const,
      draftStorageScope: null,
    };

    saveEvaluationPlanWorkspaceCache(storage, "teacher-1", workspace);

    expect(loadEvaluationPlanWorkspaceCache(storage, "teacher-1")).toBeNull();
  });

  it("reports a changed template instead of rebinding another template draft", () => {
    const storage = memoryStorage();
    saveEvaluationPlanDraftToStorage(storage, "v1-old", createEmptyEvaluationPlanDraft());

    expect(loadEvaluationPlanDraftFromStorage(storage, "v1-new")).toEqual({ status: "template_changed" });
  });

  it("rejects an invalid draft before overwriting storage", () => {
    const storage = memoryStorage();
    const valid = { ...createEmptyEvaluationPlanDraft(), subjectLabel: "영어" };
    saveEvaluationPlanDraftToStorage(storage, "v1-template", valid);

    const invalid = {
      ...valid,
      sections: {
        section: { fields: { note: "x".repeat(10_001) } },
      },
    };
    expect(() => saveEvaluationPlanDraftToStorage(storage, "v1-template", invalid)).toThrow();
    expect(loadEvaluationPlanDraftFromStorage(storage, "v1-template")).toEqual({ status: "found", draft: valid });
  });

  it("backs up and clears malformed storage so a new draft can be saved", () => {
    const storage = memoryStorage();
    storage.setItem("pyunga:evaluation-plan-drafts:v1", "{not-json");

    expect(resetInvalidEvaluationPlanDraftStorage(storage)).toBe(true);
    expect(loadEvaluationPlanDraftFromStorage(storage, "v1-template")).toEqual({ status: "empty" });
    expect(storage.getItem("pyunga:evaluation-plan-drafts:invalid-backup:v1")).toBe("{not-json");
  });

  it("bootstraps matching storage with the current teacher context", () => {
    const storage = memoryStorage();
    const teacherContext = {
      academicYear: 2026,
      semester: 2 as const,
      grade: 3 as const,
      subjectLabel: "영어",
    };
    const template = {
      sections: [{
        id: "root",
        title: "평가 세부계획",
        level: 1 as const,
        teacherEditableTitle: false,
        order: 0,
        config: createDefaultEvaluationTemplateSectionConfig("title_only"),
      }],
    };
    const storedDraft = {
      ...createEmptyEvaluationPlanDraft(),
      subjectLabel: "과거 과목",
    };

    saveEvaluationPlanDraftToStorage(
      storage,
      getEvaluationPlanTemplateSignature(template, teacherContext),
      storedDraft,
    );

    const result = loadEvaluationPlanDraftBootstrap(storage, template, teacherContext);
    expect(result.status).toBe("found");
    expect(result.draft).toMatchObject({
      academicYear: "2026",
      semester: "2",
      grade: "3",
      subjectLabel: "영어",
    });
  });
});
