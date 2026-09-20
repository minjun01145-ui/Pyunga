import { Timestamp } from "firebase-admin/firestore";

import { getFirebaseAdminDatabase } from "@/shared/firebase/admin";
import {
  normalizeEvaluationTemplateSections,
  type EvaluationTemplate,
  type EvaluationTemplateSectionInput,
  type EvaluationTemplateSource,
} from "../domain/evaluation-template";
import { parseCompatibleEvaluationTemplateSectionConfig } from "../domain/evaluation-template-section-config-compat";

const TEMPLATE_DOCUMENT_ID = "current";

export class EvaluationTemplateRevisionConflictError extends Error {
  constructor() {
    super("평가계획 양식이 다른 화면에서 먼저 변경되었습니다. 최신 내용을 다시 불러온 뒤 저장해 주세요.");
    this.name = "EvaluationTemplateRevisionConflictError";
  }
}

export type EvaluationTemplateState = {
  template: EvaluationTemplate | null;
  revision: number;
};

export async function saveEvaluationTemplate(params: {
  schoolId: string;
  userId: string;
  template: EvaluationTemplate;
  expectedRevision: number;
}): Promise<number> {
  const database = getFirebaseAdminDatabase();
  const document = getTemplateDocument(params.schoolId);
  return database.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(document);
    const currentRevision = snapshot.exists ? parseStoredRevision(snapshot.data()) : 0;
    if (currentRevision !== params.expectedRevision) {
      throw new EvaluationTemplateRevisionConflictError();
    }

    const nextRevision = currentRevision + 1;
    transaction.set(document, {
      ...serializeEvaluationTemplate(params.template),
      revision: nextRevision,
      updatedBy: params.userId,
      updatedAt: Timestamp.now(),
    });
    return nextRevision;
  });
}

export async function loadEvaluationTemplate(schoolId: string): Promise<EvaluationTemplate | null> {
  return (await loadEvaluationTemplateState(schoolId)).template;
}

export async function loadEvaluationTemplateState(schoolId: string): Promise<EvaluationTemplateState> {
  const snapshot = await getTemplateDocument(schoolId).get();
  if (!snapshot.exists) return { template: null, revision: 0 };

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
    revision: parseStoredRevision(data),
    template: {
      ...(documentTitle ? { documentTitle } : {}),
      sections,
      ...(source ? { source } : {}),
    },
  };
}

function serializeEvaluationTemplate(template: EvaluationTemplate) {
  return {
    ...(template.documentTitle ? { documentTitle: template.documentTitle } : {}),
    sections: template.sections.map((section) => ({
      id: section.id,
      title: section.title,
      level: section.level,
      teacherEditableTitle: section.teacherEditableTitle,
      order: section.order,
      ...(section.parentId ? { parentId: section.parentId } : {}),
      ...(section.sourcePage ? { sourcePage: section.sourcePage } : {}),
      ...(section.config ? { config: section.config } : {}),
    })),
    ...(template.source ? { source: template.source } : {}),
  };
}

function parseStoredRevision(data: FirebaseFirestore.DocumentData | undefined): number {
  const revision = data?.revision;
  if (revision === undefined) return 0;
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
    throw new Error("Stored evaluation template revision is invalid");
  }
  return revision;
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
  const teacherEditableTitle = value.teacherEditableTitle;
  const sourcePage = value.sourcePage;
  const config = value.config === undefined
    ? undefined
    : parseCompatibleEvaluationTemplateSectionConfig(value.config);

  if (
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 100 ||
    typeof title !== "string" ||
    title.length === 0 ||
    title.length > 120 ||
    (level !== 1 && level !== 2 && level !== 3 && level !== 4 && level !== 5 && level !== 6 && level !== 7) ||
    (teacherEditableTitle !== undefined && typeof teacherEditableTitle !== "boolean") ||
    (sourcePage !== undefined &&
      (typeof sourcePage !== "number" || !Number.isInteger(sourcePage) || sourcePage < 1 || sourcePage > 60)) ||
    (value.config !== undefined && !config)
  ) {
    throw new Error("Stored evaluation template section is invalid");
  }

  return {
    id,
    title,
    level,
    teacherEditableTitle: teacherEditableTitle === true,
    ...(sourcePage === undefined ? {} : { sourcePage: Number(sourcePage) }),
    ...(config ? { config } : {}),
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
