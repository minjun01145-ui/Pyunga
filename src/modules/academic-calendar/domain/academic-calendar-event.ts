export type AcademicCalendarEventType =
  | "written_exam"
  | "school_event"
  | "vacation"
  | "other";

export type AcademicCalendarEvent = {
  id: string;
  schoolId: string;
  academicYear: number;
  title: string;
  type: AcademicCalendarEventType;
  startDate: string;
  endDate?: string;
};
