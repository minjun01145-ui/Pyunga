import { describe, expect, it } from "vitest";

import {
  createPasswordCredential,
  createTemporaryPassword,
  verifyPasswordCredential,
} from "./password-credential";

describe("password credentials", () => {
  it("stores a verifiable hash instead of the password", async () => {
    const credential = await createPasswordCredential("1234");

    expect(credential.hash).not.toContain("1234");
    expect(await verifyPasswordCredential("1234", credential)).toBe(true);
    expect(await verifyPasswordCredential("4321", credential)).toBe(false);
  });

  it("creates a four digit temporary password", () => {
    expect(createTemporaryPassword()).toMatch(/^\d{4}$/);
  });
});
