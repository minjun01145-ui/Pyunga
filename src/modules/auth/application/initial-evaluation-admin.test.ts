import { describe, expect, it } from "vitest";

import {
  initialEvaluationAdminSchema,
  matchesInitialAdminBootstrapSecret,
} from "./initial-evaluation-admin";

describe("initialEvaluationAdminSchema", () => {
  it("normalizes the first account identifier", () => {
    expect(initialEvaluationAdminSchema.parse({
      loginIdentifier: "  Eval_Admin ",
      displayName: "평가계",
      schoolId: "pyunga-school",
      password: "safe-initial-password",
    }).loginIdentifier).toBe("eval_admin");
  });

  it("requires a strong initial password and a safe account identifier", () => {
    expect(initialEvaluationAdminSchema.safeParse({
      loginIdentifier: "admin@example.com",
      displayName: "평가계",
      schoolId: "pyunga-school",
      password: "short",
    }).success).toBe(false);
  });
});

describe("matchesInitialAdminBootstrapSecret", () => {
  it("requires a matching secret of at least 32 bytes", () => {
    const secret = "secure-bootstrap-secret-that-is-long-enough";
    expect(matchesInitialAdminBootstrapSecret(secret, secret)).toBe(true);
    expect(matchesInitialAdminBootstrapSecret("wrong", secret)).toBe(false);
    expect(matchesInitialAdminBootstrapSecret("short", "short")).toBe(false);
    expect(matchesInitialAdminBootstrapSecret(secret, undefined)).toBe(false);
  });
});
