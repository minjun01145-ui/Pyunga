import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const initialEvaluationAdminSchema = z.object({
  loginIdentifier: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9_-]+$/),
  displayName: z.string().trim().min(1).max(80),
  schoolId: z.string().trim().min(1).max(128),
  password: z.string().min(12).max(64),
});

export function matchesInitialAdminBootstrapSecret(provided: string, expected: string | undefined): boolean {
  if (!expected || Buffer.byteLength(expected, "utf8") < 32) return false;

  const providedBytes = Buffer.from(provided, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}
