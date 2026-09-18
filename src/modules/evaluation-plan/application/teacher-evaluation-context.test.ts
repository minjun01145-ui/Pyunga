import { describe, expect, it } from "vitest";

import {
  DEMO_TEACHER_EVALUATION_CONTEXT,
  resolveTeacherEvaluationContext,
  TeacherEvaluationContextUnavailableError,
} from "./teacher-evaluation-context";

describe("teacher evaluation context", () => {
  it("uses the fixed third-grade English context only in demo mode", () => {
    expect(resolveTeacherEvaluationContext({ demoMode: true })).toEqual(DEMO_TEACHER_EVALUATION_CONTEXT);
  });

  it("does not leak demo metadata into authenticated mode", () => {
    expect(() => resolveTeacherEvaluationContext({ demoMode: false }))
      .toThrow(TeacherEvaluationContextUnavailableError);
  });
});
