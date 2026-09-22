import { afterEach, describe, expect, it, vi } from "vitest";

import { isAuthenticationDisabled } from "./authentication-mode";

describe("isAuthenticationDisabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps authentication disabled when the deployment flag is absent", () => {
    expect(isAuthenticationDisabled()).toBe(true);
  });

  it("enables authentication when the deployment flag is true", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTHENTICATION_ENABLED", "true");
    expect(isAuthenticationDisabled()).toBe(false);
  });
});
