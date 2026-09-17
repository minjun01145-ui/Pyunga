import { describe, expect, it } from "vitest";

import { isAuthenticationDisabled } from "./authentication-mode";

describe("isAuthenticationDisabled", () => {
  it("disables authentication while account management is under development", () => {
    expect(isAuthenticationDisabled()).toBe(true);
  });
});
