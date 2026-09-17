import type {
  AcademicCalendarEventType,
  AcademicSemester,
  SchoolGrade,
  WrittenExamKind,
} from "./academic-calendar-event";

export type ReviewableAcademicCalendarEvent = {
  academicYear: number;
  title: string;
  type: AcademicCalendarEventType;
  semester: AcademicSemester;
  startDate: string;
  endDate?: string;
  targetGrades: SchoolGrade[];
  writtenExamKind?: WrittenExamKind;
};

export function getAcademicCalendarEventIssues(
  event: ReviewableAcademicCalendarEvent,
  academicYear: number,
): string[] {
  const issues: string[] = [];
  const academicYearStart = `${academicYear}-03-01`;
  const academicYearEnd = `${academicYear + 1}-02-${isLeapYear(academicYear + 1) ? "29" : "28"}`;

  if (!event.title.trim()) {
    issues.push("일정명을 입력해야 합니다.");
  }

  if (!isRealIsoDate(event.startDate)) {
    issues.push("시작일을 확인해야 합니다.");
  } else if (event.startDate < academicYearStart || event.startDate > academicYearEnd) {
    issues.push("시작일이 선택한 학년도 범위를 벗어납니다.");
  }

  if (event.endDate && !isRealIsoDate(event.endDate)) {
    issues.push("종료일을 확인해야 합니다.");
  } else if (event.endDate && event.endDate < event.startDate) {
    issues.push("종료일이 시작일보다 빠릅니다.");
  } else if (event.endDate && (event.endDate < academicYearStart || event.endDate > academicYearEnd)) {
    issues.push("종료일이 선택한 학년도 범위를 벗어납니다.");
  }

  if (event.type === "written_exam" && event.targetGrades.length === 0) {
    issues.push("시험 대상 학년을 확인해야 합니다.");
  }

  if (event.type === "written_exam" && !event.writtenExamKind) {
    issues.push("중간/기말고사 구분을 확인해야 합니다.");
  }

  if (event.type !== "written_exam" && event.writtenExamKind) {
    issues.push("정기고사가 아닌 일정에는 시험 구분을 설정할 수 없습니다.");
  }

  if (new Set(event.targetGrades).size !== event.targetGrades.length) {
    issues.push("대상 학년이 중복되어 있습니다.");
  }

  return issues;
}

export function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}
