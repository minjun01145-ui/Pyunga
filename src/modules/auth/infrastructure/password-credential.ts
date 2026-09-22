import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

const PASSWORD_KEY_LENGTH = 32;

export type StoredPasswordCredential = {
  salt: string;
  hash: string;
};

export async function createPasswordCredential(password: string): Promise<StoredPasswordCredential> {
  const salt = randomBytes(16).toString("hex");
  const hash = await derivePasswordKey(password, salt);
  return { salt, hash: hash.toString("hex") };
}

export async function verifyPasswordCredential(
  password: string,
  credential: StoredPasswordCredential,
): Promise<boolean> {
  const expected = Buffer.from(credential.hash, "hex");
  if (expected.length !== PASSWORD_KEY_LENGTH) return false;
  const actual = await derivePasswordKey(password, credential.salt);
  return timingSafeEqual(actual, expected);
}

export function parseStoredPasswordCredential(value: unknown): StoredPasswordCredential | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    !("salt" in value) ||
    !("hash" in value) ||
    typeof value.salt !== "string" ||
    typeof value.hash !== "string" ||
    value.salt.length === 0 ||
    value.hash.length === 0
  ) {
    return null;
  }

  return { salt: value.salt, hash: value.hash };
}

export function createTemporaryPassword(): string {
  return randomInt(0, 10_000).toString().padStart(4, "0");
}

function derivePasswordKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, PASSWORD_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}
