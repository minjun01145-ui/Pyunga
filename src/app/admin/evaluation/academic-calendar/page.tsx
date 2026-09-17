import { AcademicCalendarImportWorkspace } from "@/modules/academic-calendar/ui";

export default function AcademicCalendarPage() {
  return (
    <main>
      <h1 className="page-title">학사일정 관리</h1>
      <p className="page-intro muted">
        교육계획서의 학사일정을 불러와 학교 일정과 중간·기말고사를 빠짐없이 구조화하여 확인합니다.
      </p>
      <AcademicCalendarImportWorkspace />
    </main>
  );
}
