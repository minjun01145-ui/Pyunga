import {
  applyTeacherEvaluationContext,
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanTemplateSignature,
  parseEvaluationPlanDraft,
  type EvaluationPlanDraft,
} from "../application/evaluation-plan-draft";
import type { TeacherEvaluationContext } from "../application/teacher-evaluation-context";
import type { EvaluationTemplate } from "@/modules/template";

const STORAGE_KEY = "pyunga:evaluation-plan-drafts:v1";
const INVALID_BACKUP_KEY = "pyunga:evaluation-plan-drafts:invalid-backup:v1";
const MAX_STORED_TEMPLATE_VERSIONS = 8;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredDraftEntry = {
  templateSignature: string;
  draft: EvaluationPlanDraft;
};

type StoredDraftCollection = {
  version: 1;
  entries: StoredDraftEntry[];
};

export type EvaluationPlanDraftStorageResult =
  | { status: "empty" }
  | { status: "found"; draft: EvaluationPlanDraft }
  | { status: "template_changed" }
  | { status: "invalid" };

export type EvaluationPlanDraftBootstrapResult = {
  status: EvaluationPlanDraftStorageResult["status"];
  draft: EvaluationPlanDraft;
};

export function loadEvaluationPlanDraftBootstrap(
  storage: StorageLike,
  template: EvaluationTemplate | null,
  teacherContext: TeacherEvaluationContext,
): EvaluationPlanDraftBootstrapResult {
  if (!template) {
    return {
      status: "empty",
      draft: createEmptyEvaluationPlanDraft(teacherContext),
    };
  }

  const stored = loadEvaluationPlanDraftFromStorage(
    storage,
    getEvaluationPlanTemplateSignature(template, teacherContext),
  );
  if (stored.status === "found") {
    return {
      status: stored.status,
      draft: applyTeacherEvaluationContext(stored.draft, teacherContext),
    };
  }

  return {
    status: stored.status,
    draft: createEmptyEvaluationPlanDraft(teacherContext),
  };
}

export function loadEvaluationPlanDraftFromStorage(
  storage: StorageLike,
  templateSignature: string,
): EvaluationPlanDraftStorageResult {
  const stored = storage.getItem(STORAGE_KEY);
  if (!stored) return { status: "empty" };

  const collection = parseStoredCollection(stored);
  if (!collection) return { status: "invalid" };

  const matching = collection.entries.find((entry) => entry.templateSignature === templateSignature);
  if (matching) return { status: "found", draft: matching.draft };
  return collection.entries.length > 0 ? { status: "template_changed" } : { status: "empty" };
}

export function saveEvaluationPlanDraftToStorage(
  storage: StorageLike,
  templateSignature: string,
  draft: EvaluationPlanDraft,
): void {
  const validatedDraft = parseEvaluationPlanDraft(draft);
  if (!validatedDraft) {
    throw new Error("입력 내용이 허용 범위를 넘었습니다. 너무 긴 입력이나 목록 항목 수를 확인해 주세요.");
  }

  const existingRaw = storage.getItem(STORAGE_KEY);
  const existing = existingRaw ? parseStoredCollection(existingRaw) : { version: 1 as const, entries: [] };
  if (!existing) {
    throw new Error("브라우저에 저장된 기존 초안 형식이 올바르지 않아 안전하게 덮어쓸 수 없습니다.");
  }

  const entries = [
    { templateSignature, draft: validatedDraft },
    ...existing.entries.filter((entry) => entry.templateSignature !== templateSignature),
  ].slice(0, MAX_STORED_TEMPLATE_VERSIONS);

  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries } satisfies StoredDraftCollection));
}

export function resetInvalidEvaluationPlanDraftStorage(storage: StorageLike): boolean {
  const stored = storage.getItem(STORAGE_KEY);
  if (!stored || parseStoredCollection(stored)) return false;

  storage.setItem(INVALID_BACKUP_KEY, stored);
  storage.removeItem(STORAGE_KEY);
  return true;
}

function parseStoredCollection(raw: string): StoredDraftCollection | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.entries)) return null;
  if (value.entries.length > MAX_STORED_TEMPLATE_VERSIONS) return null;

  const entries: StoredDraftEntry[] = [];
  for (const rawEntry of value.entries) {
    if (!isRecord(rawEntry) || typeof rawEntry.templateSignature !== "string" || rawEntry.templateSignature.length > 40) {
      return null;
    }
    const draft = parseEvaluationPlanDraft(rawEntry.draft);
    if (!draft) return null;
    entries.push({ templateSignature: rawEntry.templateSignature, draft });
  }
  return { version: 1, entries };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
