import { describe, expect, it } from "vitest";
import type { UserProfile } from "@/modules/auth";
import type { SchoolSubject } from "@/modules/school";
import { createDefaultEvaluationTemplate, type EvaluationTemplate } from "@/modules/template";
import { createEmptyEvaluationPlanDraft } from "./evaluation-plan-draft";
import { evaluationPlanReviewSchema, evaluationPlanWriteSchema, filterPlansForActiveSubjects, getEvaluationPlanSubmissionIssues, transitionEvaluationPlan } from "./evaluation-plan-workflow";
import { resolveTeacherEvaluationContext } from "./teacher-evaluation-context";

const teacher: UserProfile = { id: "teacher-1", schoolId: "school-1", displayName: "김OO", subjectLabel: "과학", teachingGrades: [1, 3], role: "teacher", active: true, mustChangePassword: false };
const context = { academicYear: 2026, semester: 2, grade: 1, subjectLabel: "과학" } as const;
const admin = { ...teacher, id: "admin-1", role: "evaluation_admin" } as const;

describe("evaluation plan workflow", () => {
  it("excludes plans for inactive subjects while retaining legacy labels after a rename", () => {
    const subjects: SchoolSubject[] = [
      { id: "active-subject", name: "통합과학", legacyNames: ["과학"], activeForPlans: true, revision: 2, updatedAt: 1 },
      { id: "inactive-subject", name: "미술", legacyNames: [], activeForPlans: false, revision: 2, updatedAt: 1 },
    ];
    const plans = [
      { context: { ...context, subjectId: "active-subject", subjectLabel: "통합과학" } },
      { context: { ...context, subjectLabel: "과학" } },
      { context: { ...context, subjectId: "inactive-subject", subjectLabel: "미술" } },
    ];

    expect(filterPlansForActiveSubjects(plans, subjects)).toEqual(plans.slice(0, 2));
  });

  it("resolves assigned grades using the configured school academic period", () => {
    expect(resolveTeacherEvaluationContext({ demoMode: false, profile: teacher, academicPeriod: context, grade: 3 })).toMatchObject({ ...context, grade: 3 });
    expect(() => resolveTeacherEvaluationContext({ demoMode: false, profile: teacher, academicPeriod: context, grade: 2 })).toThrow();
    expect(() => resolveTeacherEvaluationContext({ demoMode: false, profile: teacher })).toThrow();
  });

  it("allows incomplete draft saves but rejects empty submissions", () => {
    const draft = createEmptyEvaluationPlanDraft(context);
    expect(evaluationPlanWriteSchema.safeParse({ draft, expectedRevision: 0, expectedTemplateRevision: 1, action: "save" }).success).toBe(true);
    expect(getEvaluationPlanSubmissionIssues({ sections: [] }, draft, context, [])).toContain("평가계획 내용을 작성한 뒤 제출해 주세요.");
  });

  it("supports submission, rejection, editing, resubmission and approval", () => {
    expect(transitionEvaluationPlan({ profile: teacher, teacherUserId: teacher.id, status: "draft", action: "submit" })).toBe("submitted");
    expect(transitionEvaluationPlan({ profile: admin, teacherUserId: teacher.id, status: "submitted", action: "reject" })).toBe("rejected");
    expect(transitionEvaluationPlan({ profile: teacher, teacherUserId: teacher.id, status: "rejected", action: "save" })).toBe("draft");
    expect(transitionEvaluationPlan({ profile: teacher, teacherUserId: teacher.id, status: "rejected", action: "submit" })).toBe("submitted");
    expect(transitionEvaluationPlan({ profile: admin, teacherUserId: teacher.id, status: "submitted", action: "approve" })).toBe("approved");
  });

  it("blocks other authors, teacher review, and edits of submitted or approved documents", () => {
    expect(() => transitionEvaluationPlan({ profile: teacher, teacherUserId: "other", status: "draft", action: "save" })).toThrow();
    expect(() => transitionEvaluationPlan({ profile: teacher, teacherUserId: teacher.id, status: "submitted", action: "approve" })).toThrow();
    for (const status of ["submitted", "approved"] as const) {
      expect(() => transitionEvaluationPlan({ profile: teacher, teacherUserId: teacher.id, status, action: "save" })).toThrow();
    }
    expect(() => transitionEvaluationPlan({ profile: admin, teacherUserId: teacher.id, status: "draft", action: "approve" })).toThrow();
  });

  it("requires a rejection reason and a valid revision", () => {
    expect(evaluationPlanReviewSchema.safeParse({ action: "reject", expectedRevision: 1, comment: "  " }).success).toBe(false);
    expect(evaluationPlanReviewSchema.safeParse({ action: "reject", expectedRevision: 2, comment: "채점기준을 보완해 주세요." }).success).toBe(true);
    expect(evaluationPlanReviewSchema.safeParse({ action: "approve", expectedRevision: -1, comment: "" }).success).toBe(false);
  });

  it("validates assessment weights across written and performance sections without counting unused assessments", () => {
    const base = createDefaultEvaluationTemplate();
    const template: EvaluationTemplate = { sections: base.sections.filter((section) => section.config?.type === "written_assessment_table" || section.config?.type === "performance_assessment_table") };
    const draft = createEmptyEvaluationPlanDraft(context);
    draft.sections["written-assessment"] = { fields: { weightPercent: "60", maxScore: "100" } };
    draft.sections["performance-assessment-1"] = { fields: { weightPercent: "40", maxScore: "20" } };
    expect(getEvaluationPlanSubmissionIssues(template, draft, context, [])).toEqual([]);
    draft.sections["performance-assessment-1"].fields.weightPercent = "30";
    expect(getEvaluationPlanSubmissionIssues(template, draft, context, []).join(" ")).toContain("90%");
    draft.sections["performance-assessment-1"].fields.maxScore = "0";
    expect(getEvaluationPlanSubmissionIssues(template, draft, context, []).join(" ")).toContain("만점");
  });
});
