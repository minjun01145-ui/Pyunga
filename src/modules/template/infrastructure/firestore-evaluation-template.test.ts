import { beforeEach, describe, expect, it, vi } from "vitest";

const firebase = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/shared/firebase/admin", () => ({
  getFirebaseAdminDatabase: () => ({
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({ get: firebase.get }),
        }),
      }),
    }),
  }),
}));

import { loadEvaluationTemplateState } from "./firestore-evaluation-template";

describe("loadEvaluationTemplateState", () => {
  beforeEach(() => {
    firebase.get.mockReset();
  });

  it("returns the built-in standard template at revision zero when the school has no saved override", async () => {
    firebase.get.mockResolvedValue({ exists: false });

    const state = await loadEvaluationTemplateState("school-1");

    expect(state.revision).toBe(0);
    expect(state.template?.documentTitle).toBe("교수학습 및 평가 운영 계획");
    expect(state.template?.sections.every((section) => section.config !== undefined)).toBe(true);
  });

  it("keeps a saved school template instead of replacing it with the built-in default", async () => {
    firebase.get.mockResolvedValue({
      exists: true,
      data: () => ({
        revision: 4,
        documentTitle: "우리 학교 평가계획",
        sections: [
          {
            id: "custom-root",
            title: "학교 맞춤 항목",
            level: 1,
            teacherEditableTitle: false,
            config: { type: "title_only" },
          },
        ],
      }),
    });

    const state = await loadEvaluationTemplateState("school-1");

    expect(state.revision).toBe(4);
    expect(state.template).toMatchObject({
      documentTitle: "우리 학교 평가계획",
      sections: [{ id: "custom-root", title: "학교 맞춤 항목", config: { type: "title_only" } }],
    });
  });
});
