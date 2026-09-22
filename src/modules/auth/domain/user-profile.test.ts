import { describe, expect, it } from "vitest";

import { parseUserProfile } from "./user-profile";

describe("parseUserProfile", () => {
  it("parses teaching grades and password-change state", () => {
    expect(parseUserProfile("user0001", {
      schoolId: "school-1",
      displayName: "김OO",
      subjectLabel: "영어",
      teachingGrades: [3, 1, 3],
      role: "teacher",
      active: true,
      mustChangePassword: true,
    })).toEqual({
      id: "user0001",
      schoolId: "school-1",
      displayName: "김OO",
      subjectLabel: "영어",
      teachingGrades: [1, 3],
      role: "teacher",
      active: true,
      mustChangePassword: true,
    });
  });

  it("keeps older administrator profiles compatible", () => {
    expect(parseUserProfile("legacy-admin", {
      schoolId: "school-1",
      displayName: "관리자",
      role: "school_admin",
      active: true,
    })).toEqual({
      id: "legacy-admin",
      schoolId: "school-1",
      displayName: "관리자",
      subjectLabel: undefined,
      teachingGrades: [],
      role: "school_admin",
      active: true,
      mustChangePassword: false,
    });
  });
});
