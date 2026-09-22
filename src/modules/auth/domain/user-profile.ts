import type { UserRole } from "./role";

export const TEACHING_GRADES = [1, 2, 3] as const;

export type TeachingGrade = (typeof TEACHING_GRADES)[number];

export type UserProfile = {
  id: string;
  schoolId: string;
  displayName: string;
  subjectLabel?: string;
  teachingGrades: TeachingGrade[];
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
};

export function formatMaskedTeacherLabel(profile: Pick<UserProfile, "displayName" | "subjectLabel">): string {
  if (!profile.subjectLabel) {
    return profile.displayName;
  }

  return `${profile.displayName} (${profile.subjectLabel})`;
}

export function parseUserProfile(id: string, value: unknown): UserProfile | null {
  if (!isRecord(value)) return null;

  const schoolId = value.schoolId;
  const displayName = value.displayName;
  const subjectLabel = value.subjectLabel;
  const role = value.role;
  const active = value.active;

  if (
    typeof schoolId !== "string" ||
    schoolId.length === 0 ||
    schoolId.length > 128 ||
    typeof displayName !== "string" ||
    displayName.length === 0 ||
    displayName.length > 80 ||
    (subjectLabel !== undefined &&
      (typeof subjectLabel !== "string" || subjectLabel.length > 80)) ||
    !isUserRole(role) ||
    typeof active !== "boolean"
  ) {
    return null;
  }

  return {
    id,
    schoolId,
    displayName,
    subjectLabel,
    teachingGrades: parseTeachingGrades(value.teachingGrades),
    role,
    active,
    mustChangePassword: value.mustChangePassword === true,
  };
}

function parseTeachingGrades(value: unknown): TeachingGrade[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isTeachingGrade))].sort((left, right) => left - right);
}

function isTeachingGrade(value: unknown): value is TeachingGrade {
  return typeof value === "number" && (TEACHING_GRADES as readonly number[]).includes(value);
}

function isUserRole(value: unknown): value is UserRole {
  return value === "school_admin" || value === "evaluation_admin" || value === "teacher";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
