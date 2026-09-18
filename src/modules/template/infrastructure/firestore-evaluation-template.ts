import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminDatabase } from "@/shared/firebase/admin";
import {
  normalizeEvaluationTemplateSections,
  type EvaluationTemplate,
  type EvaluationTemplateSectionInput,
  type EvaluationTemplateSource,
} from "../domain/evaluation-template";

const TEMPLATE_DOCUMENT_ID = "current";

export async function saveEvaluationTemplate(params: {
  schoolId: string;
  userId: string;
  template: EvaluationTemplate;
}): Promise<void> {
  const document = getTemplateDocument(params.schoolId);
  await document.set({
    ...(params.template.documentTitle ? { documentTitle: params.template.documentTitle } : {}),
    sections: params.template.sections.map((section) => ({
      id: section.id,
      title: section.title,
      level: section.level,
      order: section.order,
      ...(section.parentId ? { parentId: section.parentId } : {}),
      ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
    })),
    ...(params.template.source ? { source: params.template.source } : {}),
    updatedBy: params.userId,
    updatedAt: Timestamp.now(),
  });
}

export async function loadEvaluationTemplate(schoolId: string): Promise<EvaluationTemplate | null> {
  const snapshot = await getTemplateDocument(schoolId).get();
  if (!snapshot.exists) return null;

  const data = snapshot.data();
  if (!data || !Array.isArray(data.sections)) {
    throw new Error("Stored evaluation template is invalid");
  }

  const sectionInputs = data.sections.map(parseStoredSection);
  const sections = normalizeEvaluationTemplateSections(sectionInputs);
  const documentTitle = data.documentTitle;
  const source = data.source === undefined ? undefined : parseStoredSource(data.source);

  if (documentTitle !== undefined && (typeof documentTitle !== "string" || documentTitle.length > 200)) {
    throw new Error("Stored evaluation template title is invalid");
  }

  return {
    ...(documentTitle ? { documentTitle } : {}),
    sections,
    ...(source ? { source } : {}),
  };
}

function getTemplateDocument(schoolId: string) {
  return getFirebaseAdminDatabase()
    .collection("schools")
    .doc(schoolId)
    .collection("evaluationTemplates")
    .doc(TEMPLATE_DOCUMENT_ID);
}

function parseStoredSection(value: unknown): EvaluationTemplateSectionInput {
  if (!isRecord(value)) {
    throw new Error("Stored evaluation template section is invalid");
  }

  const id = value.id;
  const title = value.title;
  const level = value.level;
  const sourcePage = value.sourcePage;

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 100 ||
    typeof title !== "string" ||
    title.length === 0 ||
    title.length > 120 ||
    (level !== 1 && level !== 2 && level !== 3 && level !== 4 && level !== 5 && level !== 6 && level !== 7) ||
    (sourcePage !== undefined &&
      (typeof sourcePage !== "number" || !Number.isInteger(sourcePage) || sourcePage < 1 || sourcePage > 60))
  ) {
    throw new Error("Stored evaluation template section is invalid");
  }

  return {
    id,
    title,
    level,
    ...(sourcePage === undefined ? {} : { sourcePage: Number(sourcePage) }),
  };
}

function parseStoredSource(value: unknown): EvaluationTemplateSource {
  if (!isRecord(value)) {
    throw new Error("Stored evaluation template source is invalid");
  }

  const fileName = value.fileName;
  const totalPages = value.totalPages;
  const selectedPages = value.selectedPages;

  if (
    typeof fileName !== "string" ||
    fileName.length === 0 ||
    fileName.length > 255 ||
    typeof totalPages !== "number" ||
    !Number.isInteger(totalPages) ||
    totalPages < 1 ||
    totalPages > 60 ||
    !Array.isArray(selectedPages) ||
    selectedPages.some(
      (page) => typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > 60,
    )
  ) {
    throw new Error("Stored evaluation template source is invalid");
  }

  return {
    fileName,
    totalPages,
    selectedPages: selectedPages as number[],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
