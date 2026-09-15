import type { UserRole } from "../domain/role";

export type ProvisionUserCommand = {
  schoolId: string;
  displayName: string;
  subjectLabel?: string;
  role: UserRole;
  loginIdentifier: string;
};

export type ProvisionedUser = {
  userId: string;
  loginIdentifier: string;
};

/**
 * Authentication provider boundary.
 *
 * The product requirement (school admin provisions accounts) is fixed,
 * but the exact Firebase Auth mapping for a human-friendly login ID is not fixed yet.
 * Infrastructure must implement this contract without leaking provider-specific hacks into Domain/Application.
 */
export interface UserAccountProvisioner {
  provision(command: ProvisionUserCommand): Promise<ProvisionedUser>;
  disable(userId: string): Promise<void>;
  changeRole(userId: string, role: UserRole): Promise<void>;
}
