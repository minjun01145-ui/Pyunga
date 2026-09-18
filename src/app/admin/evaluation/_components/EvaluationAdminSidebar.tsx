"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { authenticatedFetch } from "@/shared/firebase/authenticated-fetch";
import styles from "./EvaluationAdminSidebar.module.css";

type SavedSection = {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  order: number;
};

type TemplateResponse = {
  template: { sections: SavedSection[] } | null;
};

export function EvaluationAdminSidebar() {
  const pathname = usePathname();
  const [majorSections, setMajorSections] = useState<SavedSection[]>([]);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(() => pathname.startsWith("/admin/evaluation/template"));

  const loadMajorSections = useCallback(async () => {
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections");
      if (!response.ok) return;
      const body = (await response.json()) as TemplateResponse;
      setMajorSections(
        (body.template?.sections ?? [])
          .filter((section) => section.level === 1)
          .sort((left, right) => left.order - right.order),
      );
    } catch {
      setMajorSections([]);
    }
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/admin/evaluation/template")) {
      setIsTemplateMenuOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    void loadMajorSections();
    const handleSaved = () => void loadMajorSections();
    window.addEventListener("evaluation-template-saved", handleSaved);
    return () => window.removeEventListener("evaluation-template-saved", handleSaved);
  }, [loadMajorSections]);

  return (
    <aside className="evaluation-admin-sidebar" aria-label="평가계 메뉴">
      <h2 className="evaluation-admin-sidebar-title">평가계용</h2>
      <ul className="evaluation-admin-menu">
        <li><Link href="/admin/evaluation/academic-calendar">학사일정 관리</Link></li>
        <li className={styles.menuGroup}>
          <button
            className={styles.menuButton}
            type="button"
            aria-expanded={isTemplateMenuOpen}
            onClick={() => setIsTemplateMenuOpen((open) => !open)}
          >
            평가계획 양식 관리
          </button>
          {isTemplateMenuOpen ? (
            <ul className={styles.submenu}>
              <li>
                <Link href="/admin/evaluation/template/major-sections">대분류 관리</Link>
                {majorSections.length > 0 ? (
                  <ul className={styles.sectionMenu} aria-label="저장된 대분류">
                    {majorSections.map((section) => (
                      <li key={section.id}><span>{section.title}</span></li>
                    ))}
                  </ul>
                ) : null}
              </li>
            </ul>
          ) : null}
        </li>
        <li><Link href="/admin/evaluation/ai-test">AI 작동 테스트</Link></li>
        <li>사용자 관리</li>
      </ul>
    </aside>
  );
}
