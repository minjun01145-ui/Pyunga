import { getApps, initializeApp, type App } from "firebase-admin/app";

/**
 * App Hosting / Google Cloud runtime should use Application Default Credentials.
 * Do not commit service-account JSON files to the repository.
 */
export function getFirebaseAdminApp(): App {
  return getApps()[0] ?? initializeApp();
}
