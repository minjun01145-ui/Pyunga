"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { AcademicCalendarEvent } from "@/modules/academic-calendar";
import {
  buildTeachingLearningCalendarRows,
  applyTeacherEvaluationContext,
  createEmptyEvaluationPlanDraft,
  getEvaluationPlanDraftTemplateIssues,
  getEvaluationPlanTemplateSignature,
  serializeEvaluationPlanDraft,
  EVALUATION_PLAN_STATUS_LABELS,
  getEvaluationPlanSubmissionIssues,
  type EvaluationPlanWorkspaceData,
  type EvaluationPlanWorkspaceResponse,
  type EvaluationPlanSummary,
  type SavedEvaluationPlan,
  type EvaluationPlanDraft,
  type EvaluationPlanDraftFieldValue,
  type EvaluationPlanDraftSection,
  type TeacherEvaluationContext,
} from "@/modules/evaluation-plan";
import type { EvaluationTemplate, EvaluationTemplateSection } from "@/modules/template";
import { authenticatedFetch } from "@/modules/auth/client";
import { isAuthenticationDisabled } from "@/modules/auth";
import { getFirebaseClientAuth } from "@/shared/firebase/client";
import { useUnsavedChangesGuard } from "@/shared/ui/useUnsavedChangesGuard";
import {
  getEvaluationPlanDraftStorageSignature,
  loadEvaluationPlanWorkspaceCache,
  loadEvaluationPlanDraftEntryFromStorage,
  resetInvalidEvaluationPlanDraftStorage,
  saveEvaluationPlanDraftToStorage,
  saveEvaluationPlanWorkspaceCache,
  shouldUseLocalEvaluationPlanDraft,
  type StoredEvaluationPlanDraft,
} from "../infrastructure/browser-evaluation-plan-draft";

import { EvaluationPlanTemplateTable } from "./EvaluationPlanTemplateTable";
import styles from "./EvaluationPlanWorkspace.module.css";

type SaveReason = "explicit" | "section" | "safety" | "preview" | "submit";
type LocalSaveMetadata = Pick<StoredEvaluationPlanDraft, "updatedAt" | "serverRevisionAtSync" | "serverUpdatedAtAtSync">;

const SAFETY_SAVE_INTERVAL_MS = 10 * 60 * 1000;
const AUTOMATIC_RETRY_COOLDOWN_MS = 60 * 1000;

export function EvaluationPlanWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceSearch = searchParams.toString();
  const [template, setTemplate] = useState<EvaluationTemplate | null>(null);
  const [teacherContext, setTeacherContext] = useState<TeacherEvaluationContext | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<AcademicCalendarEvent[]>([]);
  const [draft, setDraft] = useState<EvaluationPlanDraft>(createEmptyEvaluationPlanDraft);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [hasInvalidStorage, setHasInvalidStorage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPlan, setSavedPlan] = useState<SavedEvaluationPlan | null>(null);
  const [templateRevision, setTemplateRevision] = useState(0);
  const [persistence, setPersistence] = useState<"browser" | "server">("browser");
  const [teachingGrades, setTeachingGrades] = useState<number[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [previewSubjects, setPreviewSubjects] = useState<Array<{ id: string; name: string }> | null>(null);
  const [previewSubjectId, setPreviewSubjectId] = useState("");
  const [previewGrade, setPreviewGrade] = useState<"1" | "2" | "3">("1");
  const [browserStorageFailed, setBrowserStorageFailed] = useState(false);
  const [serverSaveFailed, setServerSaveFailed] = useState(false);
  const [serverSaveError, setServerSaveError] = useState<string | null>(null);
  const [lastServerSavedAt, setLastServerSavedAt] = useState<string | null>(null);
  const [cachedPlanSummary, setCachedPlanSummary] = useState<EvaluationPlanSummary | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [serverCheckFailed, setServerCheckFailed] = useState(false);
  const [fallbackDraftMissing, setFallbackDraftMissing] = useState(false);
  const draftRef = useRef(draft);
  const savedPlanRef = useRef<SavedEvaluationPlan | null>(null);
  const expectedRevisionRef = useRef(0);
  const serverBaselineRef = useRef(serializeEvaluationPlanDraft(createEmptyEvaluationPlanDraft()));
  const isDirtyRef = useRef(false);
  const localEditVersionRef = useRef(0);
  const storageSignatureRef = useRef("");
  const storageScopeRef = useRef<string | undefined>(undefined);
  const workspaceCacheOwnerRef = useRef<string | null>(null);
  const localSaveMetadataRef = useRef<LocalSaveMetadata>({ updatedAt: null, serverRevisionAtSync: null, serverUpdatedAtAtSync: null });
  const saveInProgressRef = useRef(false);
  const pendingCheckpointRef = useRef(false);
  const lastSaveAttemptAtRef = useRef(0);
  const lastMajorSectionRef = useRef<string | null>(null);
  const saveDraftRef = useRef<(reason: SaveReason, openPreview?: boolean, submit?: boolean) => Promise<void>>(async () => undefined);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      let cacheOwnerId: string | null = null;
      let usedWorkspaceCache = false;
      let cachedStorageSignature: string | null = null;
      let cachedEditVersion = 0;
      const requestedPreview = new URLSearchParams(workspaceSearch).get("preview") === "1";
      try {
        const search = workspaceSearch ? `?${workspaceSearch}` : "";
        const responseRequest = authenticatedFetch(`/api/teacher/evaluation-plan${search}`)
          .then((response) => ({ response }), (requestError: unknown) => ({ requestError }));
        try {
          if (isAuthenticationDisabled()) {
            cacheOwnerId = "demo";
          } else {
            const auth = getFirebaseClientAuth();
            await auth.authStateReady();
            cacheOwnerId = auth.currentUser?.uid ?? null;
          }
          workspaceCacheOwnerRef.current = cacheOwnerId;
          if (cacheOwnerId && !requestedPreview) {
            const cached = loadEvaluationPlanWorkspaceCache(window.localStorage, cacheOwnerId);
            if (cached) {
              usedWorkspaceCache = true;
              const scope = cached.draftStorageScope ?? undefined;
              const signature = getEvaluationPlanDraftStorageSignature(cached.template, cached.teacherContext, scope);
              cachedStorageSignature = signature;
              cachedEditVersion = localEditVersionRef.current;
              storageScopeRef.current = scope;
              storageSignatureRef.current = signature;
              setTemplate(cached.template);
              setTeacherContext(cached.teacherContext);
              setCalendarEvents(cached.calendarEvents);
              setTemplateRevision(cached.templateRevision);
              setPersistence(cached.persistence);
              setTeachingGrades(cached.teachingGrades);
              setSavedPlan(null);
              savedPlanRef.current = null;
              expectedRevisionRef.current = cached.savedPlanSummary?.revision ?? 0;
              setCachedPlanSummary(cached.savedPlanSummary);
              setLastServerSavedAt(cached.savedPlanSummary?.updatedAt ?? null);
              setIsCheckingServer(true);
              setServerCheckFailed(false);

              const emptyDraft = createEmptyEvaluationPlanDraft(cached.teacherContext);
              let localResult: ReturnType<typeof loadEvaluationPlanDraftEntryFromStorage> = { status: "empty" };
              try {
                localResult = loadEvaluationPlanDraftEntryFromStorage(window.localStorage, signature, scope);
              } catch {
                setBrowserStorageFailed(true);
              }
              if (localResult.status === "invalid") {
                setHasInvalidStorage(true);
                setError("브라우저에 저장된 평가계획 초안 형식이 올바르지 않습니다. 기존 데이터를 보호하기 위해 덮어쓰지 않습니다.");
              }
              const localEntry = localResult.status === "found"
                ? {
                  ...localResult.entry,
                  draft: applyTeacherEvaluationContext(localResult.entry.draft, cached.teacherContext),
                }
                : null;
              const summary = cached.savedPlanSummary;
              const localMatchesCachedServer = Boolean(localEntry && summary
                && localEntry.serverRevisionAtSync === summary.revision
                && localEntry.serverUpdatedAtAtSync === summary.updatedAt
                && localEntry.updatedAt === summary.updatedAt);
              const initialDraft = localEntry?.draft ?? emptyDraft;
              const initialBaseline = localMatchesCachedServer
                ? serializeEvaluationPlanDraft(initialDraft)
                : summary
                  ? `cached-server-revision:${summary.revision}`
                  : serializeEvaluationPlanDraft(emptyDraft);
              const initialDirty = localEntry
                ? (summary
                  ? !localMatchesCachedServer
                  : serializeEvaluationPlanDraft(initialDraft) !== serializeEvaluationPlanDraft(emptyDraft))
                : false;
              draftRef.current = initialDraft;
              setDraft(initialDraft);
              serverBaselineRef.current = initialBaseline;
              isDirtyRef.current = initialDirty;
              setIsDirty(initialDirty);
              localSaveMetadataRef.current = localEntry
                ? {
                  updatedAt: localEntry.updatedAt,
                  serverRevisionAtSync: localEntry.serverRevisionAtSync,
                  serverUpdatedAtAtSync: localEntry.serverUpdatedAtAtSync,
                }
                : {
                  updatedAt: summary?.updatedAt ?? null,
                  serverRevisionAtSync: summary?.revision ?? 0,
                  serverUpdatedAtAtSync: summary?.updatedAt ?? null,
                };
              const missingEditableDraft = Boolean(summary
                && summary.status !== "submitted"
                && summary.status !== "approved"
                && !localEntry);
              setFallbackDraftMissing(missingEditableDraft);
              if (localResult.status === "template_changed") {
                setStorageNotice("평가계 양식이 변경되었습니다. 이전 양식의 초안은 브라우저에 보존되어 있습니다.");
              } else if (initialDirty) {
                setStorageNotice("이 기기에 서버에 아직 저장되지 않은 초안이 있습니다. 최신 작업을 유지했습니다.");
              } else if (missingEditableDraft) {
                setStorageNotice("이 기기에 저장된 초안이 없습니다. 서버 확인이 끝날 때까지 입력을 잠시 사용할 수 없습니다.");
              }
              setIsLoading(false);
            }
          }
        } catch {
          setBrowserStorageFailed(true);
        }

        const requestResult = await responseRequest;
        if ("requestError" in requestResult) throw requestResult.requestError;
        const response = requestResult.response;
        const fetchedBody = (await response.json()) as EvaluationPlanWorkspaceResponse;
        if (cancelled) return;
        if ("previewSelectionRequired" in fetchedBody && fetchedBody.previewSelectionRequired) {
          setPreviewSubjects(fetchedBody.previewSubjects);
          setPreviewSubjectId((current) => fetchedBody.previewSubjects.some((subject) => subject.id === current)
            ? current
            : fetchedBody.previewSubjects[0]?.id ?? "");
          setTemplate(fetchedBody.template);
          setTemplateRevision(fetchedBody.templateRevision);
          setPreviewMode(true);
          setIsCheckingServer(false);
          setError(null);
          return;
        }
        const workspaceBody = fetchedBody as EvaluationPlanWorkspaceData;
        if (!workspaceBody.teacherContext) throw new Error(workspaceBody.error ?? "교사 작성 정보를 확인하지 못했습니다.");
        const currentSave = savedPlanRef.current;
        const body = currentSave && currentSave.revision > (workspaceBody.savedPlan?.revision ?? 0)
          ? { ...workspaceBody, savedPlan: currentSave }
          : workspaceBody;
        if (!response.ok) throw new Error(body.error ?? "평가계획 작성 자료를 불러오지 못했습니다.");
        if (cancelled) return;
        setCachedPlanSummary(null);
        setIsCheckingServer(false);
        setServerCheckFailed(false);
        setFallbackDraftMissing(false);
        setHasInvalidStorage(false);
        setError(null);
        setTemplate(body.template);
        setTeacherContext(body.teacherContext);
        setCalendarEvents(body.calendarEvents);
        setTemplateRevision(body.templateRevision);
        setPersistence(body.persistence);
        setTeachingGrades(body.teachingGrades);
        setPreviewMode(body.previewMode === true);
        setReadOnly(body.readOnly === true);
        setPreviewSubjects(null);
        setSavedPlan(body.savedPlan);
        savedPlanRef.current = body.savedPlan;
        expectedRevisionRef.current = body.savedPlan?.revision ?? 0;

        const emptyDraft = createEmptyEvaluationPlanDraft(body.teacherContext);
        const serverDraft = body.savedPlan?.draft ?? emptyDraft;
        const serverBaseline = serializeEvaluationPlanDraft(serverDraft);
        const storageScope = body.draftStorageScope ?? undefined;
        const storageSignature = body.template
          ? getEvaluationPlanDraftStorageSignature(body.template, body.teacherContext, storageScope)
          : "";
        storageScopeRef.current = storageScope;
        storageSignatureRef.current = storageSignature;
        let localResult: ReturnType<typeof loadEvaluationPlanDraftEntryFromStorage> = { status: "empty" };
        try {
          if (body.template) {
            localResult = loadEvaluationPlanDraftEntryFromStorage(window.localStorage, storageSignature, storageScope);
          }
        } catch {
          setBrowserStorageFailed(true);
        }

        if (localResult.status === "invalid") {
          draftRef.current = serverDraft;
          setDraft(serverDraft);
          serverBaselineRef.current = serverBaseline;
          isDirtyRef.current = false;
          localSaveMetadataRef.current = {
            updatedAt: body.savedPlan?.updatedAt ?? null,
            serverRevisionAtSync: body.savedPlan?.revision ?? 0,
            serverUpdatedAtAtSync: body.savedPlan?.updatedAt ?? null,
          };
          setIsDirty(false);
          setHasInvalidStorage(true);
          setError("브라우저에 저장된 평가계획 초안 형식이 올바르지 않습니다. 기존 데이터를 보호하기 위해 덮어쓰지 않습니다.");
          return;
        }

        const editedAfterCachedLoad = usedWorkspaceCache && localEditVersionRef.current > cachedEditVersion;
        const editedDraftStillMatchesTemplate = editedAfterCachedLoad && cachedStorageSignature === storageSignature;
        const localEntry = editedDraftStillMatchesTemplate
          ? {
            draft: applyTeacherEvaluationContext(draftRef.current, body.teacherContext),
            updatedAt: localSaveMetadataRef.current.updatedAt,
            serverRevisionAtSync: localSaveMetadataRef.current.serverRevisionAtSync,
            serverUpdatedAtAtSync: localSaveMetadataRef.current.serverUpdatedAtAtSync,
          }
          : localResult.status === "found"
          ? {
            ...localResult.entry,
            draft: applyTeacherEvaluationContext(localResult.entry.draft, body.teacherContext),
          }
          : null;
        const serverIsLocked = body.savedPlan?.status === "submitted" || body.savedPlan?.status === "approved";
        const localIsNewer = localEntry !== null && (editedDraftStillMatchesTemplate || shouldUseLocalEvaluationPlanDraft(
          localEntry,
          body.savedPlan ? {
            draft: body.savedPlan.draft,
            revision: body.savedPlan.revision,
            updatedAt: body.savedPlan.updatedAt,
          } : null,
        ));
        const useLocalDraft = localIsNewer && !serverIsLocked;
        const initialDraft = useLocalDraft ? localEntry.draft : serverDraft;
        const initialBaseline = body.persistence === "server" ? serverBaseline : serializeEvaluationPlanDraft(initialDraft);
        const initialDirty = body.persistence === "server"
          && serializeEvaluationPlanDraft(initialDraft) !== initialBaseline;

        draftRef.current = initialDraft;
        setDraft(initialDraft);
        serverBaselineRef.current = initialBaseline;
        isDirtyRef.current = initialDirty;
        setIsDirty(initialDirty);
        localSaveMetadataRef.current = useLocalDraft && localEntry
          ? {
            updatedAt: localEntry.updatedAt,
            serverRevisionAtSync: localEntry.serverRevisionAtSync,
            serverUpdatedAtAtSync: localEntry.serverUpdatedAtAtSync,
          }
          : {
            updatedAt: body.savedPlan?.updatedAt ?? null,
            serverRevisionAtSync: body.savedPlan?.revision ?? 0,
            serverUpdatedAtAtSync: body.savedPlan?.updatedAt ?? null,
          };

        if (body.savedPlan && body.persistence === "server") {
          setLastServerSavedAt(body.savedPlan.updatedAt);
          setServerSaveFailed(false);
        }
        if (useLocalDraft && initialDirty) {
          setStorageNotice("이 기기에 서버에 아직 저장되지 않은 초안이 있습니다. 최신 작업을 유지했으며 다음 저장 시 서버에 반영합니다.");
        } else if (serverIsLocked && localIsNewer) {
          setStorageNotice("서버 제출본은 수정할 수 없습니다. 다른 기기의 미저장 초안은 이 브라우저에 보존되어 있습니다.");
        } else if (body.savedPlan && body.template && body.savedPlan.templateSignature !== getEvaluationPlanTemplateSignature(body.template, body.teacherContext)) {
          setStorageNotice("학교 양식이 변경되었습니다. 저장된 내용은 보존되어 있습니다. 현재 양식의 입력칸을 확인한 뒤 저장해 주세요.");
        } else if (localResult.status === "template_changed") {
          setStorageNotice("평가계 양식이 변경되었습니다. 이전 양식에서 작성한 초안은 브라우저에 보존하고 새 양식용 입력을 시작합니다.");
        } else if (editedAfterCachedLoad && !editedDraftStillMatchesTemplate) {
          setStorageNotice("서버 확인 중 양식이 변경되었습니다. 이전 양식에서 입력한 내용은 브라우저에 보존되어 있습니다.");
        }

        if (body.persistence === "server" && body.savedPlan && !useLocalDraft && !(serverIsLocked && localIsNewer)) {
          try {
            saveEvaluationPlanDraftToStorage(window.localStorage, storageSignature, initialDraft, {
              updatedAt: body.savedPlan.updatedAt,
              serverRevisionAtSync: body.savedPlan.revision,
              serverUpdatedAtAtSync: body.savedPlan.updatedAt,
              storageScope,
            });
            setBrowserStorageFailed(false);
          } catch {
            setBrowserStorageFailed(true);
          }
        }

        if (serverIsLocked && body.savedPlan) {
          setTemplate(body.savedPlan.template);
          setCalendarEvents(body.savedPlan.calendarEvents);
        }
        if (cacheOwnerId) {
          try {
            saveEvaluationPlanWorkspaceCache(window.localStorage, cacheOwnerId, body);
          } catch {
            // The draft itself is stored separately.
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setIsCheckingServer(false);
          if (usedWorkspaceCache) {
            setServerCheckFailed(true);
            setServerSaveError(loadError instanceof Error ? loadError.message : "최신 서버 자료를 확인하지 못했습니다.");
          } else {
            setError(loadError instanceof Error ? loadError.message : "평가계획 작성 자료를 불러오지 못했습니다.");
          }
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void Promise.resolve().then(() => {
      if (cancelled) return;
      setIsLoading(true);
      setPreviewSubjects(null);
      setError(null);
      return loadWorkspace();
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceSearch]);

  useEffect(() => {
    if (persistence !== "server") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void saveDraftRef.current("safety");
    }, SAFETY_SAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [persistence]);

  useEffect(() => {
    saveDraftRef.current = saveDraft;
  });

  useUnsavedChangesGuard(
    isDirty || (persistence === "browser" && browserStorageFailed),
    "서버에 저장하지 않은 평가계획 변경이 있습니다. 이 기기에 저장된 내용을 유지한 채 이동하시겠습니까?",
  );

  if (isLoading) {
    return <p className="muted">평가계획 양식과 입력 내용을 불러오는 중입니다.</p>;
  }

  if (previewSubjects) {
    return (
      <section className="panel">
        <h1 className="page-title">과목 교사용 화면 미리보기</h1>
        <p className="notice">학교 양식을 확인할 과목과 학년을 고르세요. 공식 초안이나 제출본은 열리지 않으며, 이 화면에서 저장·제출할 수 없습니다.</p>
        {previewSubjects.length === 0 ? (
          <p className="notice">평가계획 작성 대상으로 설정된 과목 분류가 없습니다. <a href="/admin/evaluation/users">사용자 관리</a>에서 과목 분류를 추가해 주세요.</p>
        ) : (
          <div className="form-grid two-columns">
            <label className="field">
              <span>과목</span>
              <select value={previewSubjectId} onChange={(event) => setPreviewSubjectId(event.target.value)}>
                {previewSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>학년</span>
              <select value={previewGrade} onChange={(event) => setPreviewGrade(event.target.value as "1" | "2" | "3")}>
                <option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option>
              </select>
            </label>
            <button className="secondary-button align-start" type="button" disabled={!previewSubjectId} onClick={() => {
              const query = new URLSearchParams({ preview: "1", subjectId: previewSubjectId, grade: previewGrade });
              router.push(`/teacher/evaluation-plan?${query.toString()}`);
            }}>양식 미리보기</button>
          </div>
        )}
      </section>
    );
  }

  if (error && !template) {
    return <p className="validation-error-box">{error}</p>;
  }

  if (!template || !teacherContext) {
    return (
      <p className="notice">
        평가계에서 평가계획 양식을 먼저 설정해야 교과 입력을 시작할 수 있습니다.
      </p>
    );
  }

  if (hasInvalidStorage) {
    return (
      <div className={styles.workspace}>
        <section className="panel">
          <h1 className="page-title">교과 평가계획 작성</h1>
          <p className="validation-error-box">{error}</p>
          <p className="small-copy">
            손상된 원본은 별도 브라우저 백업 키에 보존한 뒤 현재 초안 저장소만 초기화할 수 있습니다.
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              if (!window.confirm("손상된 초안을 백업하고 현재 초안 저장소를 초기화하시겠습니까?")) return;
              try {
                if (!resetInvalidEvaluationPlanDraftStorage(window.localStorage, storageScopeRef.current)) {
                  setError("초안 저장소를 초기화하지 못했습니다.");
                  return;
                }
              } catch {
                setError("초안 저장소를 초기화하지 못했습니다.");
                return;
              }
              const recoveredDraft = savedPlanRef.current?.draft ?? createEmptyEvaluationPlanDraft(teacherContext);
              const recoveredSerialization = serializeEvaluationPlanDraft(recoveredDraft);
              draftRef.current = recoveredDraft;
              serverBaselineRef.current = recoveredSerialization;
              isDirtyRef.current = false;
              localSaveMetadataRef.current = {
                updatedAt: savedPlanRef.current?.updatedAt ?? null,
                serverRevisionAtSync: savedPlanRef.current?.revision ?? 0,
                serverUpdatedAtAtSync: savedPlanRef.current?.updatedAt ?? null,
              };
              setDraft(recoveredDraft);
              setIsDirty(false);
              setBrowserStorageFailed(false);
              setHasInvalidStorage(false);
              setError(null);
              setStorageNotice("손상된 초안을 별도 백업한 뒤 저장소를 초기화했습니다.");
            }}
          >
            손상된 초안 백업 후 초기화
          </button>
        </section>
      </div>
    );
  }

  function updateDraft(change: (current: EvaluationPlanDraft) => EvaluationPlanDraft) {
    const nextDraft = change(draftRef.current);
    localEditVersionRef.current += 1;
    const updatedAt = new Date().toISOString();
    draftRef.current = nextDraft;
    const dirty = persistence === "server"
      && serializeEvaluationPlanDraft(nextDraft) !== serverBaselineRef.current;
    isDirtyRef.current = dirty;
    setDraft(nextDraft);
    setIsDirty(dirty);
    if (storageSignatureRef.current) {
      try {
        saveEvaluationPlanDraftToStorage(window.localStorage, storageSignatureRef.current, nextDraft, {
          updatedAt,
          serverRevisionAtSync: localSaveMetadataRef.current.serverRevisionAtSync ?? 0,
          storageScope: storageScopeRef.current,
        });
        localSaveMetadataRef.current = {
          updatedAt,
          serverRevisionAtSync: localSaveMetadataRef.current.serverRevisionAtSync,
          serverUpdatedAtAtSync: localSaveMetadataRef.current.serverUpdatedAtAtSync,
        };
        setBrowserStorageFailed(false);
      } catch {
        setBrowserStorageFailed(true);
      }
    }
    if (!dirty) {
      setServerSaveFailed(false);
      setServerSaveError(null);
    }
    setMessage(null);
    setError(null);
  }

  function updateSection(sectionId: string, change: (current: EvaluationPlanDraftSection) => EvaluationPlanDraftSection) {
    updateDraft((current) => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: change(current.sections[sectionId] ?? { fields: {} }),
      },
    }));
  }

  async function saveDraft(reason: SaveReason, openPreview = false, submit = false) {
    if (!template || !teacherContext) return;
    if (submit && isSubmitting) return;
    if (persistence === "server" && !submit && !isDirtyRef.current) {
      if (openPreview) router.push(`/teacher/evaluation-plan/preview?grade=${teacherContext.grade}`);
      return;
    }

    const automatic = reason === "section" || reason === "safety";
    if (saveInProgressRef.current) {
      if (automatic && isDirtyRef.current) pendingCheckpointRef.current = true;
      return;
    }
    if (automatic && Date.now() - lastSaveAttemptAtRef.current < AUTOMATIC_RETRY_COOLDOWN_MS) return;

    const draftToSave = draftRef.current;
    let savedSuccessfully = false;
    setIsSaving(true);
    saveInProgressRef.current = true;
    if (submit) setIsSubmitting(true);
    setMessage(null);
    if (!automatic) setError(null);
    try {
      const templateIssues = submit ? getEvaluationPlanSubmissionIssues(template, draftToSave, teacherContext, calendarEvents) : [];
      if (templateIssues.length > 0) {
        const remainingCount = templateIssues.length - 1;
        setError(
          remainingCount > 0
            ? `${templateIssues[0]} 외 ${remainingCount}건을 확인해 주세요.`
            : templateIssues[0],
        );
        return;
      }
      if (persistence === "server") {
        lastSaveAttemptAtRef.current = Date.now();
        setServerSaveFailed(false);
        setServerSaveError(null);
        const response = await authenticatedFetch("/api/teacher/evaluation-plan", {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draft: draftToSave, expectedRevision: expectedRevisionRef.current, expectedTemplateRevision: templateRevision, existingPlanId: savedPlan?.id ?? cachedPlanSummary?.id, action: submit ? "submit" : "save" }),
        });
        const body = await response.json() as { savedPlan?: SavedEvaluationPlan; error?: string };
        if (!response.ok) throw new Error(body.error ?? "평가계획을 저장하지 못했습니다.");
        if (!body.savedPlan) throw new Error("서버 저장 결과를 확인하지 못했습니다.");

        const saved = body.savedPlan;
        const savedDraftSerialization = serializeEvaluationPlanDraft(saved.draft);
        const currentDraft = draftRef.current;
        const changedWhileSaving = serializeEvaluationPlanDraft(currentDraft) !== serializeEvaluationPlanDraft(draftToSave);
        const metadataUpdatedAt = changedWhileSaving
          ? localSaveMetadataRef.current.updatedAt ?? saved.updatedAt
          : saved.updatedAt;
        savedPlanRef.current = saved;
        expectedRevisionRef.current = saved.revision;
        serverBaselineRef.current = savedDraftSerialization;
        localSaveMetadataRef.current = {
          updatedAt: metadataUpdatedAt,
          serverRevisionAtSync: saved.revision,
          serverUpdatedAtAtSync: saved.updatedAt,
        };
        setSavedPlan(saved);
        setCachedPlanSummary(null);
        setIsCheckingServer(false);
        setServerCheckFailed(false);
        setLastServerSavedAt(saved.updatedAt);

        const stillDirty = serializeEvaluationPlanDraft(currentDraft) !== savedDraftSerialization;
        isDirtyRef.current = stillDirty;
        setIsDirty(stillDirty);
        try {
          saveEvaluationPlanDraftToStorage(window.localStorage, storageSignatureRef.current, currentDraft, {
            updatedAt: metadataUpdatedAt,
            serverRevisionAtSync: saved.revision,
            serverUpdatedAtAtSync: saved.updatedAt,
            storageScope: storageScopeRef.current,
          });
          setBrowserStorageFailed(false);
        } catch {
          setBrowserStorageFailed(true);
        }
        setServerSaveFailed(false);
        setServerSaveError(null);
        const cacheOwnerId = workspaceCacheOwnerRef.current;
        if (cacheOwnerId) {
          try {
            saveEvaluationPlanWorkspaceCache(window.localStorage, cacheOwnerId, {
              template,
              templateRevision,
              teacherContext,
              calendarEvents,
              savedPlan: saved,
              teachingGrades,
              persistence: "server",
              draftStorageScope: storageScopeRef.current ?? null,
            });
          } catch {
            // The draft itself is stored separately.
          }
        }
        savedSuccessfully = true;
      } else {
        try {
          saveEvaluationPlanDraftToStorage(window.localStorage, storageSignatureRef.current, draftToSave, {
            updatedAt: new Date().toISOString(),
          });
          setBrowserStorageFailed(false);
          savedSuccessfully = true;
        } catch (storageError) {
          setBrowserStorageFailed(true);
          throw storageError;
        }
      }
      setStorageNotice(null);
      if (openPreview) {
        if (persistence === "server" && isDirtyRef.current) {
          setError("저장 요청 중 새로 입력된 내용이 있습니다. 최신 내용을 저장한 뒤 미리보기를 열어 주세요.");
          return;
        }
        router.push(`/teacher/evaluation-plan/preview?grade=${teacherContext.grade}`);
        return;
      }
      if (!automatic) setMessage(submit ? "평가계에 제출했습니다." : "평가계획 입력 내용을 저장했습니다.");
    } catch (saveError) {
      const failureMessage = saveError instanceof Error ? saveError.message : "평가계획 입력 내용을 저장하지 못했습니다.";
      if (persistence === "server") {
        setServerSaveFailed(true);
        setServerSaveError(failureMessage);
      }
      if (!automatic) setError(failureMessage);
    } finally {
      saveInProgressRef.current = false;
      setIsSaving(false);
      if (submit) setIsSubmitting(false);
      const runPendingCheckpoint = savedSuccessfully && pendingCheckpointRef.current && !submit;
      pendingCheckpointRef.current = false;
      if (runPendingCheckpoint && isDirtyRef.current) {
        lastSaveAttemptAtRef.current = 0;
        window.setTimeout(() => void saveDraftRef.current("section"), 0);
      }
    }
  }

  function handleMajorSectionFocus(sectionId: string) {
    const previousSectionId = lastMajorSectionRef.current;
    lastMajorSectionRef.current = sectionId;
    if (previousSectionId && previousSectionId !== sectionId && persistence === "server" && isDirtyRef.current) {
      void saveDraftRef.current("section");
    }
  }

  const status = savedPlan?.status ?? cachedPlanSummary?.status ?? "draft";
  const locked = previewMode || readOnly || status === "submitted" || status === "approved";
  const sectionsById = new Map(template.sections.map((section) => [section.id, section]));

  return (
    <div className={styles.workspace}>
      <section className="panel">
        <h1 className="page-title">교과 평가계획 작성</h1>
        <p className="muted page-intro">
          평가계에서 확정한 양식의 구조는 그대로 유지됩니다. 교과에서는 지정된 입력칸의 내용만 작성합니다.
        </p>
        {storageNotice ? <p className="notice">{storageNotice}</p> : null}
        <p className="small-copy">{previewMode
          ? "미리보기 · 입력 내용은 저장되거나 제출되지 않습니다."
          : readOnly
            ? "작성 대상에서 제외된 과목의 기존 평가계획을 열람하고 있습니다."
          : persistence === "browser"
            ? "체험 모드: 입력 내용은 이 브라우저에 저장됩니다. 제출은 로그인 후 이용할 수 있습니다."
            : `상태: ${EVALUATION_PLAN_STATUS_LABELS[status]}`}</p>
        <p role="status" className="small-copy">{getDraftSaveStatus({ persistence, isSaving, isDirty, isCheckingServer, serverSaveFailed, serverCheckFailed, browserStorageFailed, lastServerSavedAt })}</p>
        {serverSaveError ? <p className="small-copy">{serverSaveError}</p> : null}
        {savedPlan?.reviewComment || cachedPlanSummary?.reviewComment ? <p className="notice">검토 의견: {savedPlan?.reviewComment ?? cachedPlanSummary?.reviewComment}</p> : null}
        {teachingGrades.length > 1 ? <nav aria-label="담당 학년" className={styles.saveButtons}>{teachingGrades.map((grade) => <a key={grade} href={`/teacher/evaluation-plan?grade=${grade}`} aria-current={teacherContext.grade === grade ? "page" : undefined}>{grade}학년</a>)}</nav> : null}
        <p className={styles.teacherContextLine}>
          <strong>{teacherContext.academicYear}학년도 {teacherContext.semester}학기</strong>
          <span>{teacherContext.grade}학년</span>
          <span>{locked && savedPlan ? savedPlan.context.subjectLabel : teacherContext.subjectLabel}</span>
        </p>
      </section>

      <fieldset disabled={locked || isSubmitting || fallbackDraftMissing} className={styles.inputSections}>
      {template.sections
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((section) => (
          <TeacherSection
            key={section.id}
            section={section}
            majorSectionId={getMajorSectionId(section.id, sectionsById)}
            data={draft.sections[section.id] ?? { fields: {} }}
            teacherContext={teacherContext}
            calendarEvents={calendarEvents}
            onMajorSectionFocus={handleMajorSectionFocus}
            onChange={(change) => updateSection(section.id, change)}
          />
        ))}
      </fieldset>

      <section className={`panel ${styles.savePanel}`}>
        <div className={styles.saveButtons}>
          {previewMode ? <p className="notice">미리보기에서는 저장, 제출, 기존 교사 자료 조회를 할 수 없습니다.</p> : readOnly ? <><p className="notice">이 과목 분류는 작성 대상에서 제외되어 기존 자료를 열람만 할 수 있습니다.</p><Link className="secondary-button" href={`/teacher/evaluation-plan/preview?grade=${teacherContext.grade}`}>기존 계획 보기·인쇄</Link></> : locked ? <Link className="secondary-button" href={`/teacher/evaluation-plan/preview?grade=${teacherContext.grade}`}>제출본 보기·인쇄</Link> : <>
          <button
            className="secondary-button"
            type="button"
            disabled={isSaving || (persistence === "server" && !isDirty)}
            onClick={() => void saveDraft("explicit")}
          >
            {isSaving ? "저장 중" : persistence === "browser" ? "이 기기에 저장됨" : serverSaveFailed ? "다시 서버에 저장" : "서버에 저장"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={isSaving}
            onClick={() => void saveDraft("preview", true)}
          >
            저장하고 최종본 보기
          </button>
          <button className="secondary-button" type="button" disabled={isSaving} onClick={() => {
            const issues = getEvaluationPlanDraftTemplateIssues(template, draft, { teacherContext, calendarEvents });
            setError(issues.length ? issues.slice(0, 10).map((issue) => issue.message).join("\n") : null);
            setMessage(issues.length ? null : "입력 형식과 필수 항목 확인을 완료했습니다.");
          }}>입력 확인</button>
          {persistence === "server" ? <button className="secondary-button" type="button" disabled={isSaving} onClick={() => {
            if (window.confirm("평가계에 제출하시겠습니까? 제출 후에는 반려받은 계획만 수정할 수 있습니다.")) void saveDraft("submit", false, true);
          }}>평가계에 제출</button> : null}
          </>}
        </div>
        {message ? <p className="validation-success">{message}</p> : null}
        {error ? <p role="alert" className={`validation-error-box ${styles.errorMessage}`}>{error}</p> : null}
      </section>
    </div>
  );
}

function getMajorSectionId(sectionId: string, sectionsById: Map<string, EvaluationTemplateSection>): string {
  let current = sectionsById.get(sectionId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = sectionsById.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current?.id ?? sectionId;
}

function getDraftSaveStatus(params: {
  persistence: "browser" | "server";
  isSaving: boolean;
  isDirty: boolean;
  isCheckingServer: boolean;
  serverSaveFailed: boolean;
  serverCheckFailed: boolean;
  browserStorageFailed: boolean;
  lastServerSavedAt: string | null;
}): string {
  if (params.persistence === "browser") {
    return params.browserStorageFailed ? "이 기기에 저장하지 못했습니다." : "이 기기에 저장됨";
  }
  if (params.isSaving) {
    return params.browserStorageFailed ? "서버 저장 중… · 브라우저 저장 실패" : "서버 저장 중… · 이 기기에도 저장됨";
  }
  if (params.serverSaveFailed) {
    return params.browserStorageFailed ? "서버 저장 실패 · 브라우저 저장도 실패했습니다" : "서버 저장 실패 · 로컬에는 저장됨";
  }
  if (params.isCheckingServer) {
    if (params.isDirty) {
      return params.browserStorageFailed ? "서버 확인 중 · 서버 저장 필요 · 브라우저 저장 실패" : "서버 확인 중 · 서버 저장 필요 · 이 기기에도 저장됨";
    }
    return params.browserStorageFailed ? "이 기기에 저장됨 · 서버 확인 중 · 브라우저 저장 실패" : "이 기기에 저장됨 · 서버 확인 중…";
  }
  if (params.serverCheckFailed) {
    return params.browserStorageFailed ? "서버 확인 실패 · 브라우저 저장도 실패했습니다" : "서버 확인 실패 · 이 기기에 저장됨";
  }
  if (params.isDirty) {
    return params.browserStorageFailed ? "서버 저장 필요 · 브라우저 저장 실패" : "서버 저장 필요 · 이 기기에 저장됨";
  }
  if (params.lastServerSavedAt) {
    const savedAt = new Date(params.lastServerSavedAt);
    const time = Number.isNaN(savedAt.getTime())
      ? ""
      : new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(savedAt);
    return `서버에 저장됨${time ? ` · ${time}` : ""}${params.browserStorageFailed ? " · 브라우저 저장 실패" : ""}`;
  }
  return params.browserStorageFailed ? "서버 저장 전 · 브라우저 저장 실패" : "서버 저장 전 · 이 기기에 저장됨";
}

function TeacherSection({
  section,
  majorSectionId,
  data,
  teacherContext,
  calendarEvents,
  onMajorSectionFocus,
  onChange,
}: {
  section: EvaluationTemplateSection;
  majorSectionId: string;
  data: EvaluationPlanDraftSection;
  teacherContext: TeacherEvaluationContext;
  calendarEvents: AcademicCalendarEvent[];
  onMajorSectionFocus: (sectionId: string) => void;
  onChange: (change: (current: EvaluationPlanDraftSection) => EvaluationPlanDraftSection) => void;
}) {
  return (
    <section
      className={`panel ${styles.teacherSection}`}
      data-level={section.level}
      onFocusCapture={() => onMajorSectionFocus(majorSectionId)}
    >
      <div className={styles.sectionHeadingRow}>
        <h2 className={styles.sectionHeading}>{section.title}</h2>
        <span className="muted small-copy">{section.level}단계</span>
      </div>

      {section.teacherEditableTitle ? (
        <label className={`field ${styles.titleField}`}>
          <span>교과 제목</span>
          <input
            maxLength={120}
            placeholder={section.title}
            value={data.title ?? ""}
            onChange={(event) => onChange((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
      ) : null}

      {!section.config ? (
        <p className="validation-error-box">평가계에서 이 항목의 입력 양식을 아직 설정하지 않았습니다.</p>
      ) : section.config.type === "title_only" ? (
        <p className="muted small-copy">최종 문서에 제목만 표시되는 항목입니다.</p>
      ) : section.config.type === "outline_text" ? (
        <div className={styles.outlineEditor}>
          {section.config.commonText?.trim() ? (
            <div className={styles.commonText}>
              <strong>학교 공통 문구</strong>
              <p>{section.config.commonText}</p>
            </div>
          ) : null}
          <label className="field">
            <span>과목별 내용</span>
            <textarea
              rows={8}
              maxLength={30_000}
              value={data.body ?? ""}
              onChange={(event) => onChange((current) => ({ ...current, body: event.target.value }))}
            />
          </label>
        </div>
      ) : (
        <>
          {section.config.type === "teaching_learning_table" && section.config.calendarRows.enabled ? (() => {
            const calendarRows = buildTeachingLearningCalendarRows(section.config, calendarEvents, teacherContext);
            if (calendarRows.length === 0) {
              return <p className="notice">이 학기·학년에 해당하는 저장된 학사일정이 없어 교수학습표 행을 만들 수 없습니다.</p>;
            }
            return (
              <EvaluationPlanTemplateTable
                table={section.config.table}
                values={data.fields}
                onChange={() => undefined}
                calendarRows={calendarRows}
                rowValues={data.rows}
                onRowChange={(rowKey, fieldKey, value) => {
                  onChange((current) => ({
                    ...current,
                    rows: {
                      ...current.rows,
                      [rowKey]: {
                        fields: {
                          ...(current.rows?.[rowKey]?.fields ?? {}),
                          [fieldKey]: value,
                        },
                      },
                    },
                  }));
                }}
              />
            );
          })() : (
            <EvaluationPlanTemplateTable
              table={section.config.table}
              values={data.fields}
              onChange={(fieldKey: string, value: EvaluationPlanDraftFieldValue) => {
                onChange((current) => ({
                  ...current,
                  fields: { ...current.fields, [fieldKey]: value },
                }));
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
