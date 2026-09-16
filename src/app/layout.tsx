import type { Metadata } from "next";
import { AppNavigation } from "@/shared/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "평가계획 작성기",
  description: "중학교 평가계획 작성·검증·취합 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}
