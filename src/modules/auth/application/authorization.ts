import type { UserRole } from "../domain/role";

export const EVALUATION_MANAGEMENT_ROLES = [
  "evaluation_admin",
] as const satisfies readonly UserRole[];

export const EVALUATION_AUTHORING_ROLES = [
  "evaluation_admin",
  "teacher",
] as const satisfies readonly UserRole[];

export function canManageEvaluationPlans(role: UserRole): boolean {
  return includesRole(EVALUATION_MANAGEMENT_ROLES, role);
}

export function canEditOwnEvaluationPlan(role: UserRole): boolean {
  return includesRole(EVALUATION_AUTHORING_ROLES, role);
}

function includesRole(roles: readonly UserRole[], role: UserRole): boolean {
  return roles.includes(role);
}
