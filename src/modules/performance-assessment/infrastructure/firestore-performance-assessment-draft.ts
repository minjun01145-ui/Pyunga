import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminDatabase } from "@/shared/firebase/admin";
import type { PerformanceAssessment } from "../domain/performance-assessment";

export async function savePerformanceAssessmentDraft(params: {
  schoolId: string;
  userId: string;
  assessment: PerformanceAssessment;
}): Promise<void> {
  const reference = getFirebaseAdminDatabase()
    .collection("schools")
    .doc(params.schoolId)
    .collection("users")
    .doc(params.userId)
    .collection("performanceAssessmentDrafts")
    .doc(params.assessment.id);

  await reference.set({
    assessment: params.assessment,
    ownerUserId: params.userId,
    updatedAt: Timestamp.now(),
  });
}
