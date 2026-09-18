"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  buildEvaluationTemplateSectionNavigation,
  type EvaluationTemplateSectionNavigationNode,
} from "../domain/evaluation-template-navigation";
import type { EvaluationTemplateSection } from "../domain/evaluation-template";
import styles from "./EvaluationTemplateSectionNavigation.module.css";

type EvaluationTemplateSectionNavigationProps = {
  sections: readonly EvaluationTemplateSection[];
};

export function EvaluationTemplateSectionNavigation({
  sections,
}: EvaluationTemplateSectionNavigationProps) {
  const pathname = usePathname();
  const tree = buildEvaluationTemplateSectionNavigation(sections);

  return (
    <div className={styles.currentTemplateGroup}>
      <span className={styles.currentTemplateLabel}>&lt;현재 양식 수정&gt;</span>
      {tree.length > 0 ? (
        <ul className={styles.tree} aria-label="현재 평가계획 양식 구조">
          {tree.map((node) => (
            <NavigationNode key={node.section.id} node={node} pathname={pathname} />
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>저장된 양식이 없습니다.</p>
      )}
    </div>
  );
}

function NavigationNode({
  node,
  pathname,
}: {
  node: EvaluationTemplateSectionNavigationNode;
  pathname: string;
}) {
  const href = `/admin/evaluation/template/current/${encodeURIComponent(node.section.id)}`;
  const isActive = pathname === href;

  return (
    <li className={styles.item}>
      <Link className={`${styles.link} ${isActive ? styles.active : ""}`} href={href}>
        {node.section.title}
      </Link>
      {node.children.length > 0 ? (
        <ul className={styles.childTree}>
          {node.children.map((child) => (
            <NavigationNode key={child.section.id} node={child} pathname={pathname} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
