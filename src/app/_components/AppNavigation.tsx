import Link from "next/link";

import { AuthNavigation } from "@/modules/auth/ui/AuthNavigation";

const navigationItems = [
  { href: "/", label: "첫 화면" },
  { href: "/teacher", label: "과목교사" },
  { href: "/admin/evaluation", label: "평가계" },
] as const;

export function AppNavigation() {
  return (
    <nav className="simple-nav app-navigation" aria-label="주요 메뉴">
      <Link className="app-name" href="/">
        평가계획 작성기
      </Link>
      <div className="app-navigation-links">
        {navigationItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </div>
      <div className="app-navigation-auth">
        <AuthNavigation />
      </div>
    </nav>
  );
}
