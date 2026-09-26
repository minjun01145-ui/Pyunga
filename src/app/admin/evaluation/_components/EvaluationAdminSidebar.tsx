import Link from "next/link";

const menuItems = [
  { href: "/admin/evaluation/academic-calendar", label: "학사일정 관리" },
  { href: "/admin/evaluation/users", label: "사용자 관리" },
  { href: "/admin/evaluation/template/presentation", label: "평가계획 양식 관리" },
  { href: "/admin/evaluation", label: "교사별 작성 현황 및 검토" },
  { href: "/admin/evaluation/ai-test", label: "AI 보조기능 관리" },
] as const;

export function EvaluationAdminSidebar() {
  return (
    <aside className="evaluation-admin-sidebar" aria-label="평가계 메뉴">
      <h2 className="evaluation-admin-sidebar-title">평가계</h2>
      <ul className="evaluation-admin-menu">
        {menuItems.map((item) => (
          <li key={item.href}><Link href={item.href}>{item.label}</Link></li>
        ))}
      </ul>
    </aside>
  );
}
