import { describe, expect, it } from "vitest";

import {
  decryptTemporaryPassword,
  encryptTemporaryPassword,
  isTemporaryPasswordDeliveryExpired,
  parseEncryptedTemporaryPassword,
} from "./temporary-password-delivery";

const key = Buffer.alloc(32, 17);

describe("temporary password delivery", () => {
  it("encrypts passwords and only decrypts them with the same key", () => {
    const delivery = encryptTemporaryPassword("0042", 3, key, 1000);

    expect(delivery.ciphertext).not.toContain("0042");
    expect(decryptTemporaryPassword(delivery, key)).toBe("0042");
    expect(decryptTemporaryPassword(delivery, Buffer.alloc(32, 18))).toBeNull();
    expect(parseEncryptedTemporaryPassword(delivery)).toEqual(delivery);
  });

  it("rejects malformed delivery values and expires old delivery copies", () => {
    const delivery = encryptTemporaryPassword("0042", 1, key, 1000);

    expect(parseEncryptedTemporaryPassword({ ...delivery, iv: "bad" })).toBeNull();
    expect(isTemporaryPasswordDeliveryExpired(delivery, delivery.expiresAt)).toBe(true);
    expect(isTemporaryPasswordDeliveryExpired(delivery, delivery.expiresAt - 1)).toBe(false);
  });
});
