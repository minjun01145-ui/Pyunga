import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

export const FIRESTORE_DATABASE_ID = "pyunga-seoul";

/**
 * App Hosting / Google Cloud runtime should use Application Default Credentials.
 * Do not commit service-account JSON files to the repository.
 */
export function getFirebaseAdminApp(): App {
  return getApps()[0] ?? initializeApp();
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminDatabase(): Firestore {
  return getFirestore(getFirebaseAdminApp(), FIRESTORE_DATABASE_ID);
}
