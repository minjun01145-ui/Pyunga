export type AcademicCalendarEventType =
  | "written_exam"
  | "school_event"
  | "vacation"
  | "other";

export type AcademicSemester = 1 | 2;
export type SchoolGrade = 1 | 2 | 3;
export type WrittenExamKind = "midterm" | "final" | "other";

export type AcademicCalendarEvent = {
  id: string;
  schoolId: string;
  academicYear: number;
  title: string;
  type: AcademicCalendarEventType;
  startDate: string;
  endDate?: string;
  semester?: AcademicSemester;
  targetGrades?: SchoolGrade[];
  writtenExamKind?: WrittenExamKind;
};
