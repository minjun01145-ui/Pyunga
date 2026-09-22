import type { UserRole } from "../domain/role";
import type { TeachingGrade } from "../domain/user-profile";

export type ProvisionUserCommand = {
  schoolId: string;
  displayName: string;
  subjectLabel: string;
  teachingGrades: TeachingGrade[];
  role: UserRole;
};

export type ProvisionedUser = {
  userId: string;
  loginIdentifier: string;
  temporaryPassword: string;
};

export type ResetUserPasswordCommand = {
  schoolId: string;
  userId: string;
};

export type ResetUserPasswordResult = {
  temporaryPassword: string;
};

export type TeacherAccountSummary = {
  id: string;
  loginIdentifier: string;
  displayName: string;
  subjectLabel: string;
  teachingGrades: TeachingGrade[];
  active: boolean;
  mustChangePassword: boolean;
};

export interface UserAccountProvisioner {
  provision(command: ProvisionUserCommand): Promise<ProvisionedUser>;
  resetPassword(command: ResetUserPasswordCommand): Promise<ResetUserPasswordResult>;
}
