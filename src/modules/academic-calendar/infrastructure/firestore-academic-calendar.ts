import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminDatabase } from "@/shared/firebase/admin";
import type {
  AcademicCalendarEvent,
  AcademicCalendarEventType,
  AcademicSemester,
  SchoolGrade,
  WrittenExamKind,
} from "../domain/academic-calendar-event";
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

export async function loadAcademicCalendar(params: {
  schoolId: string;
  academicYear: number;
}): Promise<AcademicCalendarEvent[]> {
  const snapshot = await getFirebaseAdminDatabase()
    .collection("schools")
    .doc(params.schoolId)
    .collection("academicYears")
    .doc(String(params.academicYear))
    .collection("calendarEvents")
    .get();

  return snapshot.docs
    .map((document) => parseStoredAcademicCalendarEvent(params.schoolId, document.id, document.data()))
    .sort((left, right) => left.startDate.localeCompare(right.startDate));
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

function parseStoredAcademicCalendarEvent(
  schoolId: string,
  id: string,
  data: FirebaseFirestore.DocumentData,
): AcademicCalendarEvent {
  const academicYear = data.academicYear;
  const title = data.title;
  const type = data.type;
  const semester = data.semester;
  const startAt = data.startAt;
  const endAt = data.endAt;
  const targetGrades = data.targetGrades;
  const writtenExamKind = data.writtenExamKind;

  if (
    typeof academicYear !== "number"
    || !Number.isInteger(academicYear)
    || typeof title !== "string"
    || !isAcademicCalendarEventType(type)
    || !isAcademicSemester(semester)
    || !(startAt instanceof Timestamp)
    || (endAt !== undefined && !(endAt instanceof Timestamp))
    || !Array.isArray(targetGrades)
    || !targetGrades.every(isSchoolGrade)
    || (writtenExamKind !== undefined && !isWrittenExamKind(writtenExamKind))
  ) {
    throw new Error("Stored academic calendar event is invalid");
  }

  return {
    id,
    schoolId,
    academicYear,
    title,
    type,
    startDate: startAt.toDate().toISOString().slice(0, 10),
    ...(endAt instanceof Timestamp ? { endDate: endAt.toDate().toISOString().slice(0, 10) } : {}),
    semester,
    targetGrades,
    ...(writtenExamKind ? { writtenExamKind } : {}),
  };
}

function isAcademicCalendarEventType(value: unknown): value is AcademicCalendarEventType {
  return value === "written_exam" || value === "school_event" || value === "vacation" || value === "other";
}

function isAcademicSemester(value: unknown): value is AcademicSemester {
  return value === 1 || value === 2;
}

function isSchoolGrade(value: unknown): value is SchoolGrade {
  return value === 1 || value === 2 || value === 3;
}

function isWrittenExamKind(value: unknown): value is WrittenExamKind {
  return value === "midterm" || value === "final" || value === "other";
}
