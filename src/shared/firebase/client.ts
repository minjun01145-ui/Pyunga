import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

function requiredPublicEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing Firebase public environment variable: ${name}`);
  }
  return value;
}

export function getFirebaseClientApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  return initializeApp({
    apiKey: requiredPublicEnv("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: requiredPublicEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: requiredPublicEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: requiredPublicEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: requiredPublicEnv(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: requiredPublicEnv("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  });
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}
