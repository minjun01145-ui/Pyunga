import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import {
  initialEvaluationAdminSchema,
  matchesInitialAdminBootstrapSecret,
} from "@/modules/auth/application/initial-evaluation-admin";
import { createPasswordCredential } from "@/modules/auth/infrastructure/password-credential";
import { getFirebaseAdminAuth, getFirebaseAdminDatabase } from "@/shared/firebase/admin";

export const runtime = "nodejs";

const INITIAL_ADMIN_MARKER_ID = "initialEvaluationAdmin";

export async function POST(request: Request) {
  if (!matchesInitialAdminBootstrapSecret(
    request.headers.get("x-pyunga-initial-admin-key") ?? "",
    process.env.PYUNGA_INITIAL_ADMIN_KEY,
  )) {
    return NextResponse.json({ error: "초기 계정을 등록할 수 없습니다." }, { status: 404 });
  }

  const parsed = initialEvaluationAdminSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "계정 정보를 확인해 주세요." }, { status: 400 });
  }

  const database = getFirebaseAdminDatabase();
  const marker = database.collection("system").doc(INITIAL_ADMIN_MARKER_ID);
  const user = database.collection("users").doc(parsed.data.loginIdentifier);
  const existingAdminQuery = database.collection("users")
    .where("role", "in", ["evaluation_admin", "school_admin"])
    .limit(1);

  try {
    await database.runTransaction(async (transaction) => {
      const markerSnapshot = await transaction.get(marker);
      const existingAdminSnapshot = await transaction.get(existingAdminQuery);
      if (markerSnapshot.exists || !existingAdminSnapshot.empty) {
        throw new InitialEvaluationAdminAlreadyExistsError();
      }

      transaction.create(marker, {
        userId: parsed.data.loginIdentifier,
        status: "creating",
        createdAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof InitialEvaluationAdminAlreadyExistsError) {
      return NextResponse.json({ error: "평가계 계정이 이미 등록되어 있습니다." }, { status: 409 });
    }
    console.error("Initial evaluation administrator reservation failed", error);
    return NextResponse.json({ error: "초기 계정을 등록하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }

  let authUserCreated = false;
  let userProfileCreated = false;

  try {
    await getFirebaseAdminAuth().createUser({
      uid: parsed.data.loginIdentifier,
      displayName: parsed.data.displayName,
    });
    authUserCreated = true;

    await user.create({
      schoolId: parsed.data.schoolId,
      displayName: parsed.data.displayName,
      teachingGrades: [],
      role: "evaluation_admin",
      active: true,
      passwordCredential: await createPasswordCredential(parsed.data.password),
      mustChangePassword: true,
      failedLoginAttempts: 0,
      loginLockedUntil: 0,
    });
    userProfileCreated = true;

    await marker.update({
      status: "complete",
      completedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ created: true, loginIdentifier: parsed.data.loginIdentifier });
  } catch (error) {
    if (userProfileCreated) await user.delete().catch(() => undefined);
    if (authUserCreated) await getFirebaseAdminAuth().deleteUser(parsed.data.loginIdentifier).catch(() => undefined);
    await marker.delete().catch(() => undefined);
    console.error("Initial evaluation administrator creation failed", error);
    return NextResponse.json({ error: "초기 계정을 등록하는 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

class InitialEvaluationAdminAlreadyExistsError extends Error {}
