import { afterEach, describe, expect, it, vi } from "vitest";

import { isAuthenticationDisabled } from "./authentication-mode";

describe("isAuthenticationDisabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows demo mode in development when authentication is not enabled", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(isAuthenticationDisabled()).toBe(true);
  });

  it("enables authentication when the deployment flag is true", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTHENTICATION_ENABLED", "true");
    expect(isAuthenticationDisabled()).toBe(false);
  });

  it("requires authentication in production even when the flag is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_AUTHENTICATION_ENABLED", "");
    expect(isAuthenticationDisabled()).toBe(false);
  });

  it("does not allow the production flag to bypass authentication", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_AUTHENTICATION_ENABLED", "false");
    expect(isAuthenticationDisabled()).toBe(false);
  });
});
