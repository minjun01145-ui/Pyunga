import Link from "next/link";

const evaluationAdminMenuItems = [
  { label: "학사일정 관리", href: "/admin/evaluation/academic-calendar" },
  { label: "AI 작동 테스트", href: "/admin/evaluation/ai-test" },
  { label: "사용자 관리" },
  { label: "평가계획 양식 관리" },
] as const;

export function EvaluationAdminSidebar() {
  return (
    <aside className="evaluation-admin-sidebar" aria-label="평가계 메뉴">
      <h2 className="evaluation-admin-sidebar-title">평가계용</h2>
      <ul className="evaluation-admin-menu">
        {evaluationAdminMenuItems.map((item) => (
          <li key={item.label}>
            {"href" in item ? <Link href={item.href}>{item.label}</Link> : item.label}
          </li>
        ))}
      </ul>
    </aside>
  );
}
