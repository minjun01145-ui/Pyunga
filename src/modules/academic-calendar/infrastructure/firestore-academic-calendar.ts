import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminDatabase } from "@/shared/firebase/admin";
import type { AcademicCalendarSaveInput } from "../application/academic-calendar-save";

export async function saveAcademicCalendar(params: {
  schoolId: string;
  userId: string;
  input: AcademicCalendarSaveInput;
}): Promise<number> {
  const database = getFirebaseAdminDatabase();
  const now = Timestamp.now();
  const collection = database
    .collection("schools")
    .doc(params.schoolId)
    .collection("academicYears")
    .doc(String(params.input.academicYear))
    .collection("calendarEvents");

  const existingSnapshot = await collection.get();
  const nextEventIds = new Set(params.input.events.map(createEventId));

  await commitInChunks(params.input.events, 450, (batch, event) => {
    batch.set(collection.doc(createEventId(event)), {
      academicYear: event.academicYear,
      title: event.title,
      type: event.type,
      semester: event.semester,
      startAt: toTimestamp(event.startDate),
      ...(event.endDate ? { endAt: toTimestamp(event.endDate) } : {}),
      targetGrades: event.targetGrades,
      ...(event.writtenExamKind ? { writtenExamKind: event.writtenExamKind } : {}),
      sourceText: event.sourceText,
      reviewedBy: params.userId,
      updatedAt: now,
    });
  }, database);

  const staleDocuments = existingSnapshot.docs.filter((document) => !nextEventIds.has(document.id));
  await commitInChunks(staleDocuments, 450, (batch, document) => {
    batch.delete(document.ref);
  }, database);

  return params.input.events.length;
}

async function commitInChunks<T>(
  items: readonly T[],
  chunkSize: number,
  addOperation: (batch: FirebaseFirestore.WriteBatch, item: T) => void,
  database: FirebaseFirestore.Firestore,
): Promise<void> {
  for (let index = 0; index < items.length; index += chunkSize) {
    const batch = database.batch();
    for (const item of items.slice(index, index + chunkSize)) {
      addOperation(batch, item);
    }
    await batch.commit();
  }
}

function createEventId(event: AcademicCalendarSaveInput["events"][number]): string {
  const source = [
    event.type,
    event.title,
    event.startDate,
    event.endDate ?? "",
    event.targetGrades.join(","),
  ].join("|");
  return createHash("sha256").update(source).digest("hex").slice(0, 32);
}

function toTimestamp(date: string): Timestamp {
  return Timestamp.fromDate(new Date(`${date}T00:00:00.000Z`));
}
