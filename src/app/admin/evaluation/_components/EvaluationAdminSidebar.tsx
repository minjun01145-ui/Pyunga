const evaluationAdminMenuItems = [
  "학사일정 관리",
  "사용자 관리",
  "평가계획 양식 관리",
] as const;

export function EvaluationAdminSidebar() {
  return (
    <aside className="evaluation-admin-sidebar" aria-label="평가계 메뉴">
      <h2 className="evaluation-admin-sidebar-title">평가계용</h2>
      <ul className="evaluation-admin-menu">
        {evaluationAdminMenuItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </aside>
  );
}
