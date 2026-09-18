import { describe, expect, it } from "vitest";

import { createEmptyEvaluationPlanDraft } from "../application/evaluation-plan-draft";
import {
  loadEvaluationPlanDraftFromStorage,
  resetInvalidEvaluationPlanDraftStorage,
  saveEvaluationPlanDraftToStorage,
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
});
