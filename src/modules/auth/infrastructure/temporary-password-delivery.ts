import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DELIVERY_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export type EncryptedTemporaryPassword = {
  algorithm: typeof ALGORITHM;
  iv: string;
  ciphertext: string;
  authTag: string;
  issuedAt: number;
  expiresAt: number;
  revision: number;
};

export function encryptTemporaryPassword(
  password: string,
  revision: number,
  key = readEncryptionKey(),
  issuedAt = Date.now(),
): EncryptedTemporaryPassword {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return {
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    issuedAt,
    expiresAt: issuedAt + DELIVERY_LIFETIME_MS,
    revision,
  };
}

export function parseEncryptedTemporaryPassword(value: unknown): EncryptedTemporaryPassword | null {
  if (!isRecord(value)
    || value.algorithm !== ALGORITHM
    || typeof value.iv !== "string"
    || typeof value.ciphertext !== "string"
    || typeof value.authTag !== "string"
    || typeof value.issuedAt !== "number"
    || !Number.isSafeInteger(value.issuedAt)
    || typeof value.expiresAt !== "number"
    || !Number.isSafeInteger(value.expiresAt)
    || typeof value.revision !== "number"
    || !Number.isSafeInteger(value.revision)
    || value.revision < 1) {
    return null;
  }

  const iv = decodeBase64(value.iv);
  const ciphertext = decodeBase64(value.ciphertext);
  const authTag = decodeBase64(value.authTag);
  if (!iv || iv.length !== IV_LENGTH || !ciphertext || !authTag || authTag.length !== TAG_LENGTH) return null;

  return {
    algorithm: ALGORITHM,
    iv: value.iv,
    ciphertext: value.ciphertext,
    authTag: value.authTag,
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
    revision: value.revision,
  };
}

export function decryptTemporaryPassword(
  delivery: EncryptedTemporaryPassword,
  key = readEncryptionKey(),
): string | null {
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(delivery.iv, "base64"));
    decipher.setAuthTag(Buffer.from(delivery.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(delivery.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function isTemporaryPasswordDeliveryExpired(
  delivery: EncryptedTemporaryPassword,
  now = Date.now(),
): boolean {
  return delivery.expiresAt <= now;
}

export function readEncryptionKey(encoded = process.env.PYUNGA_TEMPORARY_PASSWORD_ENCRYPTION_KEY): Buffer {
  if (!encoded) throw new Error("Temporary password encryption key is not configured.");
  const key = decodeBase64(encoded);
  if (!key || key.length !== 32) throw new Error("Temporary password encryption key is invalid.");
  return key;
}

function decodeBase64(value: string): Buffer | null {
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.toString("base64") === value ? decoded : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
