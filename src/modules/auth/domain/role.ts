export const USER_ROLES = [
  "evaluation_admin",
  "teacher",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
