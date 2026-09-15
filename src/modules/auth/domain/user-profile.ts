import type { UserRole } from "./role";

export type UserProfile = {
  id: string;
  schoolId: string;
  displayName: string;
  subjectLabel?: string;
  role: UserRole;
  active: boolean;
};

export function formatMaskedTeacherLabel(profile: Pick<UserProfile, "displayName" | "subjectLabel">): string {
  if (!profile.subjectLabel) {
    return profile.displayName;
  }

  return `${profile.displayName} (${profile.subjectLabel})`;
}
