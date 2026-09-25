export function isAuthenticationDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_AUTHENTICATION_ENABLED !== "true";
}
