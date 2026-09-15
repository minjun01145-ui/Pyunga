import type { UserRole } from "../domain/role";

export function canManageSchoolUsers(role: UserRole): boolean {
  return role === "school_admin";
}

export function canManageEvaluationPlans(role: UserRole): boolean {
  return role === "school_admin" || role === "evaluation_admin";
}

export function canEditOwnEvaluationPlan(role: UserRole): boolean {
  return role === "teacher" || role === "evaluation_admin" || role === "school_admin";
}
