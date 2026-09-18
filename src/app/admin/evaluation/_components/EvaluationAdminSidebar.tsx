"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { EvaluationTemplateSection } from "@/modules/template";
import { EvaluationTemplateSectionNavigation } from "@/modules/template/ui";
import { authenticatedFetch } from "@/shared/firebase/authenticated-fetch";
import styles from "./EvaluationAdminSidebar.module.css";

type TemplateResponse = {
  template: { sections: EvaluationTemplateSection[] } | null;
};

export function EvaluationAdminSidebar() {
  const pathname = usePathname();
  const [templateSections, setTemplateSections] = useState<EvaluationTemplateSection[]>([]);
  const [isTemplateMenuManuallyOpen, setIsTemplateMenuManuallyOpen] = useState(false);
  const isTemplateMenuOpen = pathname.startsWith("/admin/evaluation/template") || isTemplateMenuManuallyOpen;

  useEffect(() => {
    let cancelled = false;

    async function loadTemplateSections() {
      try {
        const response = await authenticatedFetch("/api/admin/evaluation/template/major-sections");
        if (!response.ok) return;
        const body = (await response.json()) as TemplateResponse;
        if (!cancelled) {
          setTemplateSections(
            [...(body.template?.sections ?? [])].sort((left, right) => left.order - right.order),
          );
        }
      } catch {
        if (!cancelled) setTemplateSections([]);
      }
    }

    void loadTemplateSections();
    const handleSaved = () => void loadTemplateSections();
    window.addEventListener("evaluation-template-saved", handleSaved);

    return () => {
      cancelled = true;
      window.removeEventListener("evaluation-template-saved", handleSaved);
    };
  }, []);

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
            onClick={() => setIsTemplateMenuManuallyOpen((open) => !open)}
          >
            평가계획 양식 관리
          </button>
          {isTemplateMenuOpen ? (
            <ul className={styles.submenu}>
              <li>
                <Link href="/admin/evaluation/template/major-sections">대분류 관리</Link>
              </li>
              <li><EvaluationTemplateSectionNavigation sections={templateSections} /></li>
            </ul>
          ) : null}
        </li>
        <li><Link href="/admin/evaluation/ai-test">AI 작동 테스트</Link></li>
        <li>사용자 관리</li>
      </ul>
    </aside>
  );
}
