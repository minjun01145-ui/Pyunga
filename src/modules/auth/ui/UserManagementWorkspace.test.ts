import { describe, expect, it } from "vitest";

import type { TeacherAccountSummary } from "@/modules/auth";
import type { SchoolSubject } from "@/modules/school";
import { createSelectedTemporaryPasswordCopyText } from "./UserManagementWorkspace";

const subject: SchoolSubject = {
  id: "subject-1",
  name: "국어",
  legacyNames: [],
  activeForPlans: true,
  revision: 1,
  updatedAt: 0,
};

describe("temporary password copying", () => {
  it("formats the latest server-returned credential for only the selected users", () => {
    expect(createSelectedTemporaryPasswordCopyText([
      teacher("teacher-1", "fresh-password"),
      teacher("teacher-2", "not-selected"),
    ], ["teacher-1"], new Map([[subject.id, subject]]))).toBe(
      "교사\t국어\tteacher-1\tfresh-password",
    );
  });

  it("refuses to copy if any selected account no longer has a deliverable credential", () => {
    expect(createSelectedTemporaryPasswordCopyText([
      teacher("teacher-1", "fresh-password"),
      { ...teacher("teacher-2", "old-password"), temporaryPasswordState: "changed", temporaryPassword: undefined },
    ], ["teacher-1", "teacher-2"], new Map([[subject.id, subject]]))).toBeUndefined();
    expect(createSelectedTemporaryPasswordCopyText([], ["deleted-user"], new Map())).toBeUndefined();
  });
});

function teacher(id: string, temporaryPassword: string): TeacherAccountSummary {
  return {
    id,
    loginIdentifier: id,
    displayName: "교사",
    subjectLabel: "국어",
    subjectId: subject.id,
    teachingGrades: [1],
    active: true,
    mustChangePassword: true,
    temporaryPasswordState: "available",
    temporaryPassword,
  };
}
