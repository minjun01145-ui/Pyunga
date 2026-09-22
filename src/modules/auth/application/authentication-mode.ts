export function isAuthenticationDisabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTHENTICATION_ENABLED !== "true";
}
