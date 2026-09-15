import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EvalFlow",
  description: "중학교 평가계획 작성·검증·취합 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <nav className="simple-nav" aria-label="개발용 기본 탐색">
          <Link href="/">EvalFlow</Link>
          <Link href="/teacher">교사용</Link>
          <Link href="/admin/evaluation">평가관리</Link>
          <Link href="/admin/school">학교관리</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
