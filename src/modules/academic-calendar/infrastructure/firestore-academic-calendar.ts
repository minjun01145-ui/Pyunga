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
  const batch = database.batch();
  const now = Timestamp.now();
  const collection = database
    .collection("schools")
    .doc(params.schoolId)
    .collection("academicYears")
    .doc(String(params.input.academicYear))
    .collection("calendarEvents");

  for (const event of params.input.events) {
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
  }

  await batch.commit();
  return params.input.events.length;
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
