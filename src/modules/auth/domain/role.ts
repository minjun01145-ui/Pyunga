export const USER_ROLES = [
  "school_admin",
  "evaluation_admin",
  "teacher",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
