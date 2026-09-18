import {
  getEvaluationTemplateSectionConfigIssues,
  type EvaluationTemplateSectionConfig,
} from "./evaluation-template-section-config";

export type EvaluationTemplateSectionLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type EvaluationTemplateSection = {
  id: string;
  title: string;
  level: EvaluationTemplateSectionLevel;
  teacherEditableTitle: boolean;
  order: number;
  parentId?: string;
  sourcePage?: number;
  config?: EvaluationTemplateSectionConfig;
};

export type EvaluationTemplateSource = {
  fileName: string;
  totalPages: number;
  selectedPages: number[];
};

export type EvaluationTemplate = {
  documentTitle?: string;
  sections: EvaluationTemplateSection[];
  source?: EvaluationTemplateSource;
};

export type EvaluationTemplateSectionInput = Pick<EvaluationTemplateSection, "id" | "title" | "level"> & {
  teacherEditableTitle?: boolean;
  sourcePage?: number;
  config?: EvaluationTemplateSectionConfig;
};

const MAX_SECTION_COUNT = 100;

export function normalizeEvaluationTemplateSections(
  sections: readonly EvaluationTemplateSectionInput[],
): EvaluationTemplateSection[] {
  const normalized: EvaluationTemplateSection[] = [];
  const latestParentByLevel = new Map<EvaluationTemplateSectionLevel, string>();

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    let level = normalizeLevel(section.level);

    if (index === 0) {
      level = 1;
    } else {
      const previousLevel = normalized[index - 1].level;
      if (level > previousLevel + 1) {
        level = (previousLevel + 1) as EvaluationTemplateSectionLevel;
      }
      if (level > 1 && !latestParentByLevel.has((level - 1) as EvaluationTemplateSectionLevel)) {
        level = 1;
      }
    }

    for (const candidateLevel of [2, 3, 4, 5, 6, 7] as const) {
      if (candidateLevel >= level) {
        latestParentByLevel.delete(candidateLevel);
      }
    }

    const normalizedSection: EvaluationTemplateSection = {
      id: section.id,
      title: section.title.trim(),
      level,
      teacherEditableTitle: section.teacherEditableTitle ?? false,
      order: index,
      ...(level > 1
        ? { parentId: latestParentByLevel.get((level - 1) as EvaluationTemplateSectionLevel) }
        : {}),
      ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
      ...(section.config ? { config: section.config } : {}),
    };

    normalized.push(normalizedSection);
    latestParentByLevel.set(level, section.id);
  }

  return normalized;
}

export function getEvaluationTemplateIssues(template: EvaluationTemplate): string[] {
  const issues: string[] = [];

  if (template.sections.length === 0) {
    issues.push("대분류를 하나 이상 입력해 주세요.");
    return issues;
  }

  if (template.sections.length > MAX_SECTION_COUNT) {
    issues.push(`항목은 ${MAX_SECTION_COUNT}개 이하로 저장할 수 있습니다.`);
  }

  const ids = new Set<string>();
  for (const section of template.sections) {
    if (!section.id || section.id.length > 100) {
      issues.push("항목 식별자가 올바르지 않습니다.");
      continue;
    }
    if (ids.has(section.id)) {
      issues.push("중복된 항목 식별자가 있습니다.");
    }
    ids.add(section.id);

    if (!section.title.trim()) {
      issues.push(`${section.order + 1}번째 항목의 제목을 입력해 주세요.`);
    } else if (section.title.trim().length > 120) {
      issues.push(`${section.order + 1}번째 항목 제목은 120자 이하로 입력해 주세요.`);
    }

    if (section.sourcePage !== undefined && (!Number.isInteger(section.sourcePage) || section.sourcePage < 1)) {
      issues.push(`${section.order + 1}번째 항목의 원문 페이지 정보가 올바르지 않습니다.`);
    }

    if (section.config) {
      issues.push(...getEvaluationTemplateSectionConfigIssues(section.config));
    }
  }

  const normalized = normalizeEvaluationTemplateSections(template.sections);
  for (let index = 0; index < normalized.length; index += 1) {
    const current = template.sections[index];
    const expected = normalized[index];
    if (
      current.level !== expected.level ||
      current.order !== expected.order ||
      current.parentId !== expected.parentId
    ) {
      issues.push("항목 단계 또는 순서가 올바르지 않습니다.");
      break;
    }
  }

  if (!template.sections.some((section) => section.level === 1)) {
    issues.push("대분류가 하나 이상 필요합니다.");
  }

  return [...new Set(issues)];
}

export function getEvaluationTemplateRootSections(
  sections: readonly EvaluationTemplateSection[],
): EvaluationTemplateSection[] {
  return sections.filter((section) => section.level === 1).sort((left, right) => left.order - right.order);
}

export function canMoveEvaluationTemplateSection(
  sections: readonly EvaluationTemplateSection[],
  index: number,
  direction: -1 | 1,
): boolean {
  if (index < 0 || index >= sections.length) return false;

  const current = sections[index];
  if (direction === -1) {
    let previousStart = index - 1;
    while (previousStart >= 0 && sections[previousStart].level > current.level) {
      previousStart -= 1;
    }
    return (
      previousStart >= 0 &&
      sections[previousStart].level === current.level &&
      sections[previousStart].parentId === current.parentId
    );
  }

  const nextStart = findSectionBlockEnd(sections, index);
  return (
    nextStart < sections.length &&
    sections[nextStart].level === current.level &&
    sections[nextStart].parentId === current.parentId
  );
}

export function moveEvaluationTemplateSection(
  sections: readonly EvaluationTemplateSection[],
  index: number,
  direction: -1 | 1,
): EvaluationTemplateSection[] {
  if (index < 0 || index >= sections.length || !canMoveEvaluationTemplateSection(sections, index, direction)) {
    return [...sections];
  }

  const current = sections[index];
  const currentEnd = findSectionBlockEnd(sections, index);
  const currentBlock = sections.slice(index, currentEnd).map(toSectionInput);
  const before = sections.slice(0, index).map(toSectionInput);
  const after = sections.slice(currentEnd).map(toSectionInput);

  if (direction === -1) {
    let previousStart = index - 1;
    while (previousStart >= 0 && sections[previousStart].level > current.level) {
      previousStart -= 1;
    }
    if (
      previousStart < 0 ||
      sections[previousStart].level !== current.level ||
      sections[previousStart].parentId !== current.parentId
    ) {
      return [...sections];
    }

    const previousBlock = sections.slice(previousStart, index).map(toSectionInput);
    const prefix = sections.slice(0, previousStart).map(toSectionInput);
    return normalizeEvaluationTemplateSections([...prefix, ...currentBlock, ...previousBlock, ...after]);
  }

  if (after.length === 0) return [...sections];
  const next = sections[currentEnd];
  if (next.level !== current.level || next.parentId !== current.parentId) {
    return [...sections];
  }

  const nextEnd = findSectionBlockEnd(sections, currentEnd);
  const nextBlock = sections.slice(currentEnd, nextEnd).map(toSectionInput);
  const suffix = sections.slice(nextEnd).map(toSectionInput);
  return normalizeEvaluationTemplateSections([...before, ...nextBlock, ...currentBlock, ...suffix]);
}

export function removeEvaluationTemplateSection(
  sections: readonly EvaluationTemplateSection[],
  index: number,
): EvaluationTemplateSection[] {
  if (index < 0 || index >= sections.length) return [...sections];
  const end = findSectionBlockEnd(sections, index);
  return normalizeEvaluationTemplateSections(
    [...sections.slice(0, index), ...sections.slice(end)].map(toSectionInput),
  );
}

function findSectionBlockEnd(sections: readonly EvaluationTemplateSection[], index: number): number {
  const level = sections[index].level;
  let end = index + 1;
  while (end < sections.length && sections[end].level > level) {
    end += 1;
  }
  return end;
}

function toSectionInput(section: EvaluationTemplateSection): EvaluationTemplateSectionInput {
  return {
    id: section.id,
    title: section.title,
    level: section.level,
    teacherEditableTitle: section.teacherEditableTitle,
    ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
    ...(section.config ? { config: section.config } : {}),
  };
}

function normalizeLevel(level: EvaluationTemplateSectionLevel): EvaluationTemplateSectionLevel {
  if (level === 2 || level === 3 || level === 4 || level === 5 || level === 6 || level === 7) return level;
  return 1;
}
