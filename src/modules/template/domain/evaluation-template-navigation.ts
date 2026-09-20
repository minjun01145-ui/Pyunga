import type { EvaluationTemplateSection } from "./evaluation-template";

export type EvaluationTemplateSectionNavigationNode = {
  section: EvaluationTemplateSection;
  children: EvaluationTemplateSectionNavigationNode[];
};

export function buildEvaluationTemplateSectionNavigation(
  sections: readonly EvaluationTemplateSection[],
): EvaluationTemplateSectionNavigationNode[] {
  const sorted = [...sections].sort((left, right) => left.order - right.order);
  const nodesById = new Map<string, EvaluationTemplateSectionNavigationNode>();
  const roots: EvaluationTemplateSectionNavigationNode[] = [];

  for (const section of sorted) {
    nodesById.set(section.id, { section, children: [] });
  }

  for (const section of sorted) {
    const node = nodesById.get(section.id);
    if (!node) continue;

    const parent = section.parentId ? nodesById.get(section.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
