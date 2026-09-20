import { describe, expect, it } from "vitest";

import { USER_ROLES, type UserRole } from "../domain/role";
import {
  EVALUATION_AUTHORING_ROLES,
  EVALUATION_MANAGEMENT_ROLES,
  canEditOwnEvaluationPlan,
  canManageEvaluationPlans,
  canManageSchoolUsers,
} from "./authorization";

describe("authorization policies", () => {
  it("keeps evaluation role lists and predicates consistent", () => {
    for (const role of USER_ROLES) {
      expect(canManageEvaluationPlans(role)).toBe(
        (EVALUATION_MANAGEMENT_ROLES as readonly UserRole[]).includes(role),
      );
      expect(canEditOwnEvaluationPlan(role)).toBe(
        (EVALUATION_AUTHORING_ROLES as readonly UserRole[]).includes(role),
      );
    }
  });

  it("reserves school user management for school administrators", () => {
    expect(canManageSchoolUsers("school_admin")).toBe(true);
    expect(canManageSchoolUsers("evaluation_admin")).toBe(false);
    expect(canManageSchoolUsers("teacher")).toBe(false);
  });
});
