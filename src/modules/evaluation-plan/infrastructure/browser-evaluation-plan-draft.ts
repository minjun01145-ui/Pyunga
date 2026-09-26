import { isRealIsoDate, type AcademicCalendarEvent } from "@/modules/academic-calendar";
import {
  applyTeacherEvaluationContext,
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanTemplateSignature,
  parseEvaluationPlanDraft,
  serializeEvaluationPlanDraft,
  type EvaluationPlanDraft,
} from "../application/evaluation-plan-draft";
import { evaluationPlanSummarySchema, type EvaluationPlanSummary, type EvaluationPlanWorkspaceData } from "../application/evaluation-plan-workflow";
import type { TeacherEvaluationContext } from "../application/teacher-evaluation-context";
import { parseEvaluationTemplateSaveInput, type EvaluationTemplate } from "@/modules/template";

const STORAGE_KEY = "pyunga:evaluation-plan-drafts:v1";
const INVALID_BACKUP_KEY = "pyunga:evaluation-plan-drafts:invalid-backup:v1";
const WORKSPACE_CACHE_KEY = "pyunga:evaluation-plan-workspace:v1";
const MAX_STORED_TEMPLATE_VERSIONS = 16;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type StoredDraftEntry = {
  templateSignature: string;
  draft: EvaluationPlanDraft;
  updatedAt?: string;
  serverRevisionAtSync?: number;
  serverUpdatedAtAtSync?: string;
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

export type StoredEvaluationPlanDraft = {
  draft: EvaluationPlanDraft;
  updatedAt: string | null;
  serverRevisionAtSync: number | null;
  serverUpdatedAtAtSync: string | null;
};

export type EvaluationPlanDraftEntryStorageResult =
  | { status: "empty" }
  | { status: "found"; entry: StoredEvaluationPlanDraft }
  | { status: "template_changed" }
  | { status: "invalid" };

export type CachedEvaluationPlanWorkspace = {
  template: EvaluationTemplate;
  templateRevision: number;
  teacherContext: TeacherEvaluationContext;
  calendarEvents: AcademicCalendarEvent[];
  savedPlanSummary: EvaluationPlanSummary | null;
  teachingGrades: number[];
  persistence: "browser" | "server";
  draftStorageScope: string | null;
};

type EvaluationPlanDraftStorageOptions = {
  updatedAt?: string;
  serverRevisionAtSync?: number;
  serverUpdatedAtAtSync?: string;
  storageScope?: string;
};

export function getEvaluationPlanDraftStorageSignature(
  template: EvaluationTemplate,
  teacherContext: TeacherEvaluationContext,
  storageScope?: string | null,
): string {
  const templateSignature = getEvaluationPlanTemplateSignature(template, teacherContext);
  return storageScope && /^[a-f0-9]{64}$/i.test(storageScope)
    ? `${templateSignature}:owner-${storageScope.toLowerCase()}`
    : templateSignature;
}

export function saveEvaluationPlanWorkspaceCache(
  storage: StorageLike,
  ownerId: string,
  workspace: EvaluationPlanWorkspaceData,
): void {
  if (!workspace.template || !ownerId) return;
  const isLocked = workspace.savedPlan?.status === "submitted" || workspace.savedPlan?.status === "approved";
  const template = isLocked && workspace.savedPlan ? workspace.savedPlan.template : workspace.template;
  const calendarEvents = isLocked && workspace.savedPlan ? workspace.savedPlan.calendarEvents : workspace.calendarEvents;
  const cached: CachedEvaluationPlanWorkspace = {
    template,
    templateRevision: workspace.templateRevision,
    teacherContext: workspace.teacherContext,
    calendarEvents,
    savedPlanSummary: workspace.savedPlan ? evaluationPlanSummarySchema.parse(workspace.savedPlan) : null,
    teachingGrades: workspace.teachingGrades,
    persistence: workspace.persistence,
    draftStorageScope: workspace.draftStorageScope ?? null,
  };
  storage.setItem(getWorkspaceCacheKey(ownerId), JSON.stringify({ version: 1, workspace: cached }));
}

export function loadEvaluationPlanWorkspaceCache(
  storage: StorageLike,
  ownerId: string,
): CachedEvaluationPlanWorkspace | null {
  const raw = storage.getItem(getWorkspaceCacheKey(ownerId));
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.workspace)) return null;
  const workspace = value.workspace;
  const template = parseEvaluationTemplateSaveInput(workspace.template);
  const teacherContext = parseTeacherEvaluationContext(workspace.teacherContext);
  const calendarEvents = parseCachedCalendarEvents(workspace.calendarEvents);
  const summary = workspace.savedPlanSummary === null
    ? { success: true as const, data: null }
    : evaluationPlanSummarySchema.safeParse(workspace.savedPlanSummary);
  const teachingGrades = workspace.teachingGrades;
  const validScope = workspace.persistence === "server"
    ? typeof workspace.draftStorageScope === "string" && /^[a-f0-9]{64}$/i.test(workspace.draftStorageScope)
    : workspace.draftStorageScope === null;
  if (!template
    || !teacherContext
    || !calendarEvents
    || !summary.success
    || typeof workspace.templateRevision !== "number"
    || !Number.isInteger(workspace.templateRevision)
    || workspace.templateRevision < 0
    || !Array.isArray(teachingGrades)
    || !teachingGrades.every(isSchoolGrade)
    || (workspace.persistence !== "browser" && workspace.persistence !== "server")
    || !validScope) return null;

  return {
    template,
    templateRevision: workspace.templateRevision,
    teacherContext,
    calendarEvents,
    savedPlanSummary: summary.data,
    teachingGrades,
    persistence: workspace.persistence,
    draftStorageScope: typeof workspace.draftStorageScope === "string" ? workspace.draftStorageScope : null,
  };
}

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
  const result = loadEvaluationPlanDraftEntryFromStorage(storage, templateSignature);
  if (result.status !== "found") return result;
  return { status: "found", draft: result.entry.draft };
}

export function loadEvaluationPlanDraftEntryFromStorage(
  storage: StorageLike,
  templateSignature: string,
  storageScope?: string,
): EvaluationPlanDraftEntryStorageResult {
  const stored = storage.getItem(getStorageKey(STORAGE_KEY, storageScope));
  if (!stored) return { status: "empty" };

  const collection = parseStoredCollection(stored);
  if (!collection) return { status: "invalid" };

  const matching = collection.entries.find((entry) => entry.templateSignature === templateSignature);
  if (matching) {
    return {
      status: "found",
      entry: {
        draft: matching.draft,
        updatedAt: matching.updatedAt ?? null,
        serverRevisionAtSync: matching.serverRevisionAtSync ?? null,
        serverUpdatedAtAtSync: matching.serverUpdatedAtAtSync ?? null,
      },
    };
  }
  return collection.entries.length > 0 ? { status: "template_changed" } : { status: "empty" };
}

export function saveEvaluationPlanDraftToStorage(
  storage: StorageLike,
  templateSignature: string,
  draft: EvaluationPlanDraft,
  options: EvaluationPlanDraftStorageOptions = {},
): void {
  const validatedDraft = parseEvaluationPlanDraft(draft);
  if (!validatedDraft) {
    throw new Error("입력 내용이 허용 범위를 넘었습니다. 너무 긴 입력이나 목록 항목 수를 확인해 주세요.");
  }

  const storageKey = getStorageKey(STORAGE_KEY, options.storageScope);
  const existingRaw = storage.getItem(storageKey);
  const existing = existingRaw ? parseStoredCollection(existingRaw) : { version: 1 as const, entries: [] };
  if (!existing) {
    throw new Error("브라우저에 저장된 기존 초안 형식이 올바르지 않아 안전하게 덮어쓸 수 없습니다.");
  }

  const previousEntry = existing.entries.find((entry) => entry.templateSignature === templateSignature);
  const entries = [
    {
      templateSignature,
      draft: validatedDraft,
      updatedAt: options.updatedAt ?? new Date().toISOString(),
      serverRevisionAtSync: options.serverRevisionAtSync ?? previousEntry?.serverRevisionAtSync ?? 0,
      serverUpdatedAtAtSync: options.serverUpdatedAtAtSync ?? previousEntry?.serverUpdatedAtAtSync,
    },
    ...existing.entries.filter((entry) => entry.templateSignature !== templateSignature),
  ].slice(0, MAX_STORED_TEMPLATE_VERSIONS);

  storage.setItem(storageKey, JSON.stringify({ version: 1, entries } satisfies StoredDraftCollection));
}

export function resetInvalidEvaluationPlanDraftStorage(storage: StorageLike, storageScope?: string): boolean {
  const storageKey = getStorageKey(STORAGE_KEY, storageScope);
  const stored = storage.getItem(storageKey);
  if (!stored || parseStoredCollection(stored)) return false;

  storage.setItem(getStorageKey(INVALID_BACKUP_KEY, storageScope), stored);
  storage.removeItem(storageKey);
  return true;
}

export function shouldUseLocalEvaluationPlanDraft(
  local: StoredEvaluationPlanDraft,
  server: { draft: EvaluationPlanDraft; revision: number; updatedAt: string } | null,
): boolean {
  if (!server) return true;
  if (serializeEvaluationPlanDraft(local.draft) === serializeEvaluationPlanDraft(server.draft)) return false;

  if (local.serverRevisionAtSync === server.revision) return true;
  if (local.updatedAt) {
    const localTime = Date.parse(local.updatedAt);
    const serverTime = Date.parse(server.updatedAt);
    if (Number.isFinite(localTime) && Number.isFinite(serverTime)) return localTime > serverTime;
  }
  return local.serverRevisionAtSync === null;
}

function getStorageKey(base: string, storageScope?: string): string {
  return storageScope && /^[a-f0-9]{64}$/i.test(storageScope)
    ? `${base}:${storageScope.toLowerCase()}`
    : base;
}

function getWorkspaceCacheKey(ownerId: string): string {
  return `${WORKSPACE_CACHE_KEY}:${encodeURIComponent(ownerId)}`;
}

function parseTeacherEvaluationContext(value: unknown): TeacherEvaluationContext | null {
  if (!isRecord(value)
    || typeof value.academicYear !== "number"
    || !Number.isInteger(value.academicYear)
    || value.academicYear < 2000
    || value.academicYear > 2100
    || (value.semester !== 1 && value.semester !== 2)
    || !isSchoolGrade(value.grade)
    || typeof value.subjectLabel !== "string"
    || value.subjectLabel.length > 80) return null;
  return {
    academicYear: value.academicYear,
    semester: value.semester,
    grade: value.grade,
    subjectLabel: value.subjectLabel,
  };
}

function parseCachedCalendarEvents(value: unknown): AcademicCalendarEvent[] | null {
  if (!Array.isArray(value) || value.length > 500) return null;
  const events: AcademicCalendarEvent[] = [];
  for (const item of value) {
    if (!isRecord(item)
      || typeof item.id !== "string"
      || typeof item.schoolId !== "string"
      || typeof item.academicYear !== "number"
      || !Number.isInteger(item.academicYear)
      || typeof item.title !== "string"
      || (item.type !== "written_exam" && item.type !== "school_event" && item.type !== "vacation" && item.type !== "other")
      || typeof item.startDate !== "string"
      || !isRealIsoDate(item.startDate)
      || (item.endDate !== undefined && (typeof item.endDate !== "string" || !isRealIsoDate(item.endDate)))
      || (item.semester !== undefined && item.semester !== 1 && item.semester !== 2)
      || (item.targetGrades !== undefined && (!Array.isArray(item.targetGrades) || !item.targetGrades.every(isSchoolGrade)))
      || (item.writtenExamKind !== undefined
        && item.writtenExamKind !== "midterm"
        && item.writtenExamKind !== "final"
        && item.writtenExamKind !== "other")) return null;
    events.push({
      id: item.id,
      schoolId: item.schoolId,
      academicYear: item.academicYear,
      title: item.title,
      type: item.type,
      startDate: item.startDate,
      ...(typeof item.endDate === "string" ? { endDate: item.endDate } : {}),
      ...(item.semester === 1 || item.semester === 2 ? { semester: item.semester } : {}),
      ...(Array.isArray(item.targetGrades) ? { targetGrades: item.targetGrades } : {}),
      ...(item.writtenExamKind === "midterm" || item.writtenExamKind === "final" || item.writtenExamKind === "other"
        ? { writtenExamKind: item.writtenExamKind }
        : {}),
    });
  }
  return events;
}

function isSchoolGrade(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
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
    if (!isRecord(rawEntry)
      || typeof rawEntry.templateSignature !== "string"
      || rawEntry.templateSignature.length === 0
      || rawEntry.templateSignature.length > 120) {
      return null;
    }
    const draft = parseEvaluationPlanDraft(rawEntry.draft);
    if (!draft) return null;
    if (rawEntry.updatedAt !== undefined
      && (typeof rawEntry.updatedAt !== "string" || rawEntry.updatedAt.length > 40)) return null;
    if (rawEntry.serverUpdatedAtAtSync !== undefined
      && (typeof rawEntry.serverUpdatedAtAtSync !== "string" || rawEntry.serverUpdatedAtAtSync.length > 40)) return null;
    if (rawEntry.serverRevisionAtSync !== undefined
      && (typeof rawEntry.serverRevisionAtSync !== "number"
        || !Number.isInteger(rawEntry.serverRevisionAtSync)
        || rawEntry.serverRevisionAtSync < 0)) return null;
    entries.push({
      templateSignature: rawEntry.templateSignature,
      draft,
      ...(typeof rawEntry.updatedAt === "string" ? { updatedAt: rawEntry.updatedAt } : {}),
      ...(typeof rawEntry.serverRevisionAtSync === "number" ? { serverRevisionAtSync: rawEntry.serverRevisionAtSync } : {}),
      ...(typeof rawEntry.serverUpdatedAtAtSync === "string" ? { serverUpdatedAtAtSync: rawEntry.serverUpdatedAtAtSync } : {}),
    });
  }
  return { version: 1, entries };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
