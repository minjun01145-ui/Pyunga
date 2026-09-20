import type { EvaluationTemplateSection } from "./evaluation-template";

export type TeacherSectionTitlePresentation =
  | {
      editable: false;
      fixedTitle: string;
    }
  | {
      editable: true;
      exampleTitle: string;
    };

export function getTeacherSectionTitlePresentation(
  section: Pick<EvaluationTemplateSection, "title" | "teacherEditableTitle">,
): TeacherSectionTitlePresentation {
  if (section.teacherEditableTitle) {
    return {
      editable: true,
      exampleTitle: section.title,
    };
  }

  return {
    editable: false,
    fixedTitle: section.title,
  };
}
