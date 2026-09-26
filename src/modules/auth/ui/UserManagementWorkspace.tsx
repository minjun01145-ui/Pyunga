"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  isAuthenticationDisabled,
  TEACHING_GRADES,
  type TeacherAccountSummary,
  type TeachingGrade,
} from "@/modules/auth";
import { authenticatedFetch } from "@/modules/auth/client";
import {
  normalizeSubjectName,
  type CurriculumSubjectImportAssessment,
  type SchoolSubject,
} from "@/modules/school";

type ManagementResponse = {
  subjects: SchoolSubject[];
  users: TeacherAccountSummary[];
  targetAcademicYear: number | null;
};

type EditableCandidate = {
  name: string;
  grade: TeachingGrade | null;
  include: boolean;
};

type EditingTeacher = {
  userId: string;
  displayName: string;
  subjectId: string;
  teachingGrades: TeachingGrade[];
  active: boolean;
};

export function UserManagementWorkspace() {
  const authenticationDisabled = isAuthenticationDisabled();
  const [subjects, setSubjects] = useState<SchoolSubject[]>([]);
  const [users, setUsers] = useState<TeacherAccountSummary[]>([]);
  const [targetAcademicYear, setTargetAcademicYear] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(!authenticationDisabled);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState("");
  const [addingUserToSubjectId, setAddingUserToSubjectId] = useState<string | null>(null);
  const [newUserName, setNewUserName] = useState("");
  const [newUserGrades, setNewUserGrades] = useState<TeachingGrade[]>([]);
  const [editingTeacher, setEditingTeacher] = useState<EditingTeacher | null>(null);
  const [selectedPasswordUsers, setSelectedPasswordUsers] = useState<string[]>([]);
  const [copyFallbackOpen, setCopyFallbackOpen] = useState(false);
  const [copyFallbackText, setCopyFallbackText] = useState("");
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importAssessment, setImportAssessment] = useState<CurriculumSubjectImportAssessment | null>(null);
  const [importCandidates, setImportCandidates] = useState<EditableCandidate[]>([]);
  const [newCandidateName, setNewCandidateName] = useState("");

  const loadManagementData = useCallback(async () => {
    const response = await authenticatedFetch("/api/admin/evaluation/subjects", { cache: "no-store" });
    const body = await response.json() as ManagementResponse & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "과목 분류와 사용자 목록을 불러오지 못했습니다.");
    setSubjects(body.subjects);
    setUsers(body.users);
    setTargetAcademicYear(body.targetAcademicYear);
    setSelectedPasswordUsers((current) => current.filter((id) =>
      body.users.some((user) => user.id === id && user.active && user.temporaryPasswordState === "available"),
    ));
  }, []);

  useEffect(() => {
    if (authenticationDisabled) return;
    let cancelled = false;
    void Promise.resolve().then(() => cancelled ? undefined : loadManagementData())
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "과목 분류와 사용자 목록을 불러오지 못했습니다.");
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [authenticationDisabled, loadManagementData]);

  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const availablePasswordUsers = useMemo(
    () => users.filter((user) => user.active && user.temporaryPasswordState === "available" && user.temporaryPassword),
    [users],
  );
  const selectedPasswords = useMemo(
    () => availablePasswordUsers.filter((user) => selectedPasswordUsers.includes(user.id)),
    [availablePasswordUsers, selectedPasswordUsers],
  );

  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const normalized = normalizeSubjectName(newSubjectName);
    if (subjects.some((subject) => normalizeSubjectName(subject.name).toLocaleLowerCase("ko-KR")
      === normalized.toLocaleLowerCase("ko-KR"))) {
      setError("같은 이름의 과목 분류가 이미 있습니다.");
      return;
    }
    setBusyId("new-subject");
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names: [normalized] }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "과목 분류를 추가하지 못했습니다.");
      setNewSubjectName("");
      setMessage("과목 분류를 추가했습니다.");
      await loadManagementData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "과목 분류를 추가하지 못했습니다.");
    } finally { setBusyId(null); }
  }

  async function saveSubjectName(subject: SchoolSubject) {
    setBusyId(subject.id);
    setError(null);
    setMessage(null);
    try {
      const response = await authenticatedFetch(`/api/admin/evaluation/subjects/${encodeURIComponent(subject.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", name: editingSubjectName, expectedRevision: subject.revision }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "과목명을 저장하지 못했습니다.");
      setEditingSubjectId(null);
      setMessage("과목명을 저장했습니다.");
      await loadManagementData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "과목명을 저장하지 못했습니다.");
    } finally { setBusyId(null); }
  }

  async function toggleSubjectInclusion(subject: SchoolSubject) {
    const include = !subject.activeForPlans;
    if (!include && !window.confirm(
      `${subject.name}을 평가계획 작성 대상에서 제외할까요? 연결된 사용자와 계획이 있으면 자료는 보존됩니다.`,
    )) return;
    setBusyId(subject.id);
    setError(null);
    setMessage(null);
    try {
      const response = await authenticatedFetch(`/api/admin/evaluation/subjects/${encodeURIComponent(subject.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "include", activeForPlans: include, expectedRevision: subject.revision }),
      });
      const body = await response.json() as { deleted?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error ?? "과목 분류 상태를 변경하지 못했습니다.");
      setMessage(body.deleted
        ? "참조되지 않은 과목 분류를 삭제했습니다."
        : include ? "과목 분류를 작성 대상으로 복원했습니다." : "과목 분류를 제외했습니다. 연결 자료는 보존됩니다.");
      await loadManagementData();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "과목 분류 상태를 변경하지 못했습니다.");
    } finally { setBusyId(null); }
  }

  async function createTeacher(event: FormEvent<HTMLFormElement>, subjectId: string) {
    event.preventDefault();
    setBusyId(subjectId);
    setError(null);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newUserName, subjectId, teachingGrades: newUserGrades }),
      });
      const body = await response.json() as {
        user?: TeacherAccountSummary;
        temporaryPassword?: string;
        error?: string;
      };
      if (!response.ok || !body.user || !body.temporaryPassword) {
        throw new Error(body.error ?? "사용자 계정을 만들지 못했습니다.");
      }
      const createdUser: TeacherAccountSummary = {
        ...body.user,
        temporaryPasswordState: "available",
        temporaryPassword: body.temporaryPassword,
      };
      setUsers((current) => [...current, createdUser].sort((left, right) => left.loginIdentifier.localeCompare(right.loginIdentifier)));
      setSelectedPasswordUsers((current) => current.includes(createdUser.id) ? current : [...current, createdUser.id]);
      setNewUserName("");
      setNewUserGrades([]);
      setAddingUserToSubjectId(null);
      setMessage("사용자를 추가했습니다. 임시 비밀번호를 아래 목록에서 다시 확인하거나 복사할 수 있습니다.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "사용자 계정을 만들지 못했습니다.");
    } finally { setBusyId(null); }
  }

  async function saveTeacher() {
    if (!editingTeacher) return;
    setBusyId(editingTeacher.userId);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/admin/evaluation/users/${encodeURIComponent(editingTeacher.userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editingTeacher.displayName,
          subjectId: editingTeacher.subjectId,
          teachingGrades: editingTeacher.teachingGrades,
          active: editingTeacher.active,
        }),
      });
      const body = await response.json() as { user?: TeacherAccountSummary; error?: string };
      if (!response.ok || !body.user) throw new Error(body.error ?? "사용자 정보를 저장하지 못했습니다.");
      setUsers((current) => current.map((user) => user.id === body.user!.id ? body.user! : user));
      setEditingTeacher(null);
      setMessage("사용자 정보를 저장했습니다.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "사용자 정보를 저장하지 못했습니다.");
    } finally { setBusyId(null); }
  }

  async function toggleTeacherActive(user: TeacherAccountSummary) {
    const nextActive = !user.active;
    if (!nextActive && !window.confirm(`${user.displayName} 계정을 사용 중지할까요?`)) return;
    const subjectId = user.subjectId ?? "";
    setBusyId(user.id);
    setError(null);
    try {
      const response = await authenticatedFetch(`/api/admin/evaluation/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: user.displayName,
          subjectId,
          teachingGrades: user.teachingGrades,
          active: nextActive,
        }),
      });
      const body = await response.json() as { user?: TeacherAccountSummary; error?: string };
      if (!response.ok || !body.user) throw new Error(body.error ?? "계정 상태를 변경하지 못했습니다.");
      setUsers((current) => current.map((item) => item.id === user.id ? body.user! : item));
      setSelectedPasswordUsers((current) => current.filter((id) => id !== user.id));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "계정 상태를 변경하지 못했습니다.");
    } finally { setBusyId(null); }
  }

  async function resetPassword(user: TeacherAccountSummary) {
    if (!user.active || !window.confirm(`${user.displayName} 사용자의 임시 비밀번호를 재발급할까요? 이전 값은 즉시 사용할 수 없게 됩니다.`)) return;
    setBusyId(user.id);
    setError(null);
    setMessage(null);
    try {
      const response = await authenticatedFetch(
        `/api/admin/evaluation/users/${encodeURIComponent(user.id)}/reset-password`,
        { method: "POST" },
      );
      const body = await response.json() as { temporaryPassword?: string; error?: string };
      if (!response.ok || !body.temporaryPassword) throw new Error(body.error ?? "비밀번호를 재발급하지 못했습니다.");
      setUsers((current) => current.map((item) => item.id === user.id
        ? { ...item, mustChangePassword: true, temporaryPasswordState: "available", temporaryPassword: body.temporaryPassword }
        : item));
      setSelectedPasswordUsers((current) => current.includes(user.id) ? current : [...current, user.id]);
      setMessage("임시 비밀번호를 재발급했습니다. 이전 값은 더 이상 유효하지 않습니다.");
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "비밀번호를 재발급하지 못했습니다.");
    } finally { setBusyId(null); }
  }

  async function importCurriculum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsImporting(true);
    setError(null);
    setMessage(null);
    setImportAssessment(null);
    setImportCandidates([]);
    const formData = new FormData();
    if (importFile) formData.set("file", importFile);
    else formData.set("pastedText", pastedText);
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/subjects/import", {
        method: "POST",
        body: formData,
      });
      const body = await response.json() as { assessment?: CurriculumSubjectImportAssessment; error?: string };
      if (!response.ok || !body.assessment) throw new Error(body.error ?? "교육과정표를 분석하지 못했습니다.");
      setImportAssessment(body.assessment);
      setImportCandidates(body.assessment.candidates.map((candidate) => ({ ...candidate, include: true })));
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "교육과정표를 분석하지 못했습니다.");
    } finally { setIsImporting(false); }
  }

  async function confirmImportedSubjects() {
    const names = importCandidates
      .filter((candidate) => candidate.include)
      .map((candidate) => normalizeSubjectName(candidate.name))
      .filter(Boolean);
    if (names.length === 0) {
      setError("추가할 과목 후보를 하나 이상 선택해 주세요.");
      return;
    }
    setBusyId("curriculum-import");
    setError(null);
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      const body = await response.json() as { subjects?: SchoolSubject[]; error?: string };
      if (!response.ok || !body.subjects) throw new Error(body.error ?? "선택한 과목을 저장하지 못했습니다.");
      await loadManagementData();
      setImportAssessment(null);
      setImportCandidates([]);
      setImportFile(null);
      setPastedText("");
      setMessage("과목 분류를 반영했습니다. 사용자 계정은 별도로 추가해 주세요.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "선택한 과목을 저장하지 못했습니다.");
    } finally { setBusyId(null); }
  }

  async function copySelectedPasswords() {
    const selectedUserIds = [...new Set(selectedPasswordUsers)];
    if (selectedUserIds.length === 0) return;
    setError(null);

    let freshUsers: TeacherAccountSummary[];
    try {
      const search = new URLSearchParams();
      for (const userId of selectedUserIds) search.append("userId", userId);
      const response = await authenticatedFetch(`/api/admin/evaluation/users?${search.toString()}`, { cache: "no-store" });
      const body = await response.json() as { users?: TeacherAccountSummary[]; error?: string };
      if (!response.ok || !body.users) throw new Error(body.error ?? "선택한 계정의 최신 임시 비밀번호를 확인하지 못했습니다.");
      freshUsers = body.users;
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "선택한 계정의 최신 임시 비밀번호를 확인하지 못했습니다.");
      return;
    }

    const latestCopyText = createSelectedTemporaryPasswordCopyText(freshUsers, selectedUserIds, subjectById);
    const freshUsersById = new Map(freshUsers.map((user) => [user.id, user]));
    setUsers((current) => current.map((user) => freshUsersById.get(user.id) ?? user));
    if (!latestCopyText) {
      setCopyFallbackOpen(false);
      setCopyFallbackText("");
      setCopyMessage("선택한 계정 중 임시 비밀번호를 다시 확인할 수 없는 항목이 있습니다. 목록을 확인한 뒤 다시 복사해 주세요.");
      try {
        await loadManagementData();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "최신 사용자 목록을 불러오지 못했습니다.");
      }
      return;
    }

    setCopyFallbackText(latestCopyText);
    try {
      await navigator.clipboard.writeText(latestCopyText);
      setCopyFallbackOpen(false);
      setCopyMessage(`${selectedUserIds.length}개 임시 비밀번호를 복사했습니다.`);
    } catch {
      setCopyFallbackOpen(true);
      setCopyMessage("아래 내용 전체를 선택해 복사해 주세요.");
    }
  }

  function updateGrade(grades: TeachingGrade[], grade: TeachingGrade): TeachingGrade[] {
    return grades.includes(grade)
      ? grades.filter((item) => item !== grade)
      : [...grades, grade].sort((left, right) => left - right);
  }

  if (authenticationDisabled) {
    return <p className="notice">사용자 관리는 평가계 로그인이 활성화된 환경에서 사용할 수 있습니다.</p>;
  }

  return (
    <div className="workspace-stack">
      <section className="panel">
        <h1 className="page-title">사용자 관리</h1>
        <h2 className="section-title">과목 분류</h2>
        <p className="small-copy">과목 분류를 먼저 추가한 뒤 해당 분류 아래에서 사용자를 관리합니다. PDF 없이도 직접 추가할 수 있습니다.</p>
        <form className="form-grid two-columns" onSubmit={(event) => void addSubject(event)}>
          <label className="field">
            <span>과목명</span>
            <input maxLength={80} required value={newSubjectName} onChange={(event) => setNewSubjectName(event.target.value)} />
          </label>
          <div className="save-actions">
            <button className="secondary-button" type="submit" disabled={busyId !== null || isLoading}>
              {busyId === "new-subject" ? "추가 중" : "과목 분류 추가"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2 className="section-title first-section-title">교육과정표에서 과목 가져오기</h2>
        {targetAcademicYear === null ? (
          <p className="notice">
            작성 학년도가 설정되지 않았습니다. <Link href="/admin/evaluation/template/presentation">평가계획 양식 관리</Link>에서 작성 학년도와 학기를 먼저 설정해 주세요.
          </p>
        ) : (
          <p className="muted small-copy">기준 학년도: {targetAcademicYear}학년도. 분석 결과는 검토 후 확정하며, 사용자 계정은 자동 발급하지 않습니다.</p>
        )}
        <form className="workspace-stack" onSubmit={(event) => void importCurriculum(event)}>
          <label className="field">
            <span>교육과정표 PDF</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              disabled={targetAcademicYear === null || isImporting}
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="field">
            <span>또는 표에서 복사한 텍스트·탭 구분 내용 붙여넣기</span>
            <textarea
              rows={5}
              maxLength={50_000}
              value={pastedText}
              disabled={targetAcademicYear === null || isImporting}
              onChange={(event) => setPastedText(event.target.value)}
            />
          </label>
          <button className="secondary-button align-start" type="submit" disabled={targetAcademicYear === null || isImporting || (!importFile && !pastedText.trim())}>
            {isImporting ? "교육과정표 분석 중" : "과목 후보 분석"}
          </button>
        </form>
        {importAssessment ? (
          <section className="curriculum-review" aria-label="교육과정표 분석 결과">
            <h3 className="subsection-title">분석 결과 확인</h3>
            <p className={importAssessment.status === "current_all_grades" ? "validation-success" : "notice"}>
              {importAssessment.message}
            </p>
            <dl className="curriculum-evidence">
              <dt>표 제목</dt><dd>{importAssessment.tableTitle ?? "확인되지 않음"}</dd>
              <dt>표에 적힌 학년도</dt><dd>{importAssessment.statedAcademicYear ?? "확인되지 않음"}</dd>
              <dt>기준 작성 학년도</dt><dd>{importAssessment.targetAcademicYear}</dd>
              <dt>범위</dt><dd>{importAssessment.coverage === "all_grades" ? "전체 학년 편성" : importAssessment.coverage === "single_cohort_three_years" ? "한 기수의 3개년 편성" : "확인 필요"}</dd>
              <dt>학년별 적용 연도</dt>
              <dd>{importAssessment.gradeApplicationYears.length
                ? importAssessment.gradeApplicationYears.map((item) => `${item.grade}학년 ${item.academicYear}학년도 (${item.evidence})`).join(" · ")
                : "확인 근거 없음"}</dd>
              <dt>판정 근거</dt><dd>{importAssessment.evidence.length ? importAssessment.evidence.join(" · ") : "확인 근거 없음"}</dd>
            </dl>
            {importAssessment.status === "current_all_grades" ? (
              <>
                <h4>과목 후보</h4>
                <p className="muted small-copy">과목이 표에 존재하는지 확인해 주세요. 특정 학년·학기의 실제 편성이나 평가계획 대상 여부와는 별개입니다.</p>
                {importCandidates.map((candidate, index) => {
                  const duplicate = subjects.find((subject) => normalizeSubjectName(subject.name).toLocaleLowerCase("ko-KR")
                    === normalizeSubjectName(candidate.name).toLocaleLowerCase("ko-KR"));
                  return (
                    <div className="curriculum-candidate" key={`${candidate.name}-${index}`}>
                      <label>
                        <input type="checkbox" checked={candidate.include} onChange={(event) => setImportCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, include: event.target.checked } : item))} />
                        {candidate.grade ? `${candidate.grade}학년 표 · ` : ""}
                      </label>
                      <input aria-label="과목 후보명" maxLength={80} value={candidate.name} onChange={(event) => setImportCandidates((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                      {duplicate ? <span className="muted small-copy">이미 등록됨</span> : null}
                    </div>
                  );
                })}
                <form className="form-grid two-columns" onSubmit={(event) => {
                  event.preventDefault();
                  const name = normalizeSubjectName(newCandidateName);
                  if (!name) return;
                  setImportCandidates((current) => [...current, { name, grade: null, kind: "course", include: true }]);
                  setNewCandidateName("");
                }}>
                  <label className="field"><span>과목 후보 직접 추가</span><input maxLength={80} value={newCandidateName} onChange={(event) => setNewCandidateName(event.target.value)} /></label>
                  <div className="save-actions"><button className="text-button" type="submit">후보 추가</button></div>
                </form>
                <button className="secondary-button" type="button" disabled={busyId !== null} onClick={() => void confirmImportedSubjects()}>
                  {busyId === "curriculum-import" ? "저장 중" : "선택한 과목 분류 확정"}
                </button>
              </>
            ) : null}
          </section>
        ) : null}
      </section>

      {isLoading ? <p className="muted">과목 분류와 사용자 정보를 불러오고 있습니다.</p> : null}
      {subjects.map((subject) => {
        const subjectUsers = users.filter((user) => user.subjectId === subject.id);
        return (
          <section className="panel" key={subject.id}>
            <header className="subject-management-header">
              {editingSubjectId === subject.id ? (
                <>
                  <label className="field"><span>과목명</span><input maxLength={80} value={editingSubjectName} onChange={(event) => setEditingSubjectName(event.target.value)} /></label>
                  <button className="secondary-button" type="button" disabled={busyId === subject.id} onClick={() => void saveSubjectName(subject)}>과목명 저장</button>
                  <button className="text-button" type="button" onClick={() => setEditingSubjectId(null)}>취소</button>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="section-title first-section-title">{subject.name}</h2>
                    <p className="muted small-copy">{subject.activeForPlans ? "평가계획 작성 대상" : "작성 대상 제외 · 사용자와 기존 계획 보존"}</p>
                  </div>
                  <div className="user-account-actions">
                    <button className="text-button" type="button" onClick={() => { setEditingSubjectId(subject.id); setEditingSubjectName(subject.name); }}>과목명 수정</button>
                    {subject.activeForPlans ? (
                      <button className="text-button" type="button" disabled={busyId === subject.id} onClick={() => void toggleSubjectInclusion(subject)}>작성 대상 제외</button>
                    ) : (
                      <button className="text-button" type="button" disabled={busyId === subject.id} onClick={() => void toggleSubjectInclusion(subject)}>작성 대상으로 복원</button>
                    )}
                    {subject.activeForPlans ? (
                      <button className="text-button" type="button" onClick={() => { setAddingUserToSubjectId(subject.id); setNewUserName(""); setNewUserGrades([]); }}>사용자 추가</button>
                    ) : null}
                  </div>
                </>
              )}
            </header>

            {addingUserToSubjectId === subject.id ? (
              <form className="form-grid three-columns" onSubmit={(event) => void createTeacher(event, subject.id)}>
                <label className="field"><span>이름</span><input maxLength={80} required value={newUserName} onChange={(event) => setNewUserName(event.target.value)} /></label>
                <fieldset className="field user-grade-field">
                  <legend>담당 학년</legend>
                  <div className="user-grade-options">
                    {TEACHING_GRADES.map((grade) => <label key={grade}><input type="checkbox" checked={newUserGrades.includes(grade)} onChange={() => setNewUserGrades((current) => updateGrade(current, grade))} />{grade}학년</label>)}
                  </div>
                </fieldset>
                <div className="save-actions">
                  <button className="secondary-button" type="submit" disabled={busyId === subject.id || newUserGrades.length === 0}>{busyId === subject.id ? "추가 중" : "사용자 계정 추가"}</button>
                  <button className="text-button" type="button" onClick={() => setAddingUserToSubjectId(null)}>취소</button>
                </div>
              </form>
            ) : null}

            {subjectUsers.length === 0 ? <p className="notice">등록된 사용자가 없습니다.</p> : (
              <div className="calendar-table-scroll">
                <table className="simple-table user-management-table">
                  <thead><tr><th>아이디</th><th>이름</th><th>과목 분류</th><th>담당 학년</th><th>계정 상태</th><th>임시 비밀번호</th><th>작업</th></tr></thead>
                  <tbody>
                    {subjectUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.loginIdentifier}</td>
                        <td>{editingTeacher?.userId === user.id ? (
                          <input aria-label="이름" maxLength={80} value={editingTeacher.displayName} onChange={(event) => setEditingTeacher((current) => current ? { ...current, displayName: event.target.value } : current)} />
                        ) : user.displayName}</td>
                        <td>{editingTeacher?.userId === user.id ? (
                          <select aria-label="과목 분류" value={editingTeacher.subjectId} onChange={(event) => setEditingTeacher((current) => current ? { ...current, subjectId: event.target.value } : current)}>
                            {subjects.filter((item) => item.activeForPlans || item.id === editingTeacher.subjectId).map((item) => <option key={item.id} value={item.id}>{item.name}{item.activeForPlans ? "" : " (작성 대상 제외)"}</option>)}
                          </select>
                        ) : subject.name}</td>
                        <td>{editingTeacher?.userId === user.id ? (
                          <fieldset className="user-grade-field"><legend className="visually-hidden">담당 학년</legend><div className="user-grade-options">{TEACHING_GRADES.map((grade) => <label key={grade}><input type="checkbox" checked={editingTeacher.teachingGrades.includes(grade)} onChange={() => setEditingTeacher((current) => current ? { ...current, teachingGrades: updateGrade(current.teachingGrades, grade) } : current)} />{grade}학년</label>)}</div></fieldset>
                        ) : formatTeachingGrades(user.teachingGrades)}</td>
                        <td>{formatAccountStatus(user)}</td>
                        <td>{user.temporaryPasswordState === "available" && user.temporaryPassword ? (
                          <label><input type="checkbox" checked={selectedPasswordUsers.includes(user.id)} onChange={(event) => setSelectedPasswordUsers((current) => event.target.checked ? [...new Set([...current, user.id])] : current.filter((id) => id !== user.id))} /> <code>{user.temporaryPassword}</code></label>
                        ) : user.temporaryPasswordState === "expired" ? "보관 기간 만료" : user.temporaryPasswordState === "changed" ? "변경 완료" : user.mustChangePassword ? "조회 불가 · 재발급 필요" : "-"}</td>
                        <td>
                          <div className="user-account-actions">
                            {editingTeacher?.userId === user.id ? (
                              <>
                                <button className="text-button" type="button" disabled={busyId === user.id || editingTeacher.teachingGrades.length === 0} onClick={() => void saveTeacher()}>정보 저장</button>
                                <button className="text-button" type="button" onClick={() => setEditingTeacher(null)}>취소</button>
                              </>
                            ) : (
                              <button className="text-button" type="button" onClick={() => setEditingTeacher({ userId: user.id, displayName: user.displayName, subjectId: user.subjectId ?? subject.id, teachingGrades: user.teachingGrades, active: user.active })}>사용자 수정</button>
                            )}
                            <button className="text-button" type="button" disabled={!user.active || busyId === user.id} onClick={() => void resetPassword(user)}>{user.active ? "비밀번호 재발급" : "계정 사용 후 재발급"}</button>
                            <button className="text-button" type="button" disabled={busyId === user.id} onClick={() => void toggleTeacherActive(user)}>{user.active ? "사용 중지" : "다시 사용"}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {users.some((user) => !user.subjectId || !subjectById.has(user.subjectId)) ? (
        <section className="panel">
          <h2 className="section-title first-section-title">과목 분류 연결이 필요한 사용자</h2>
          <p className="muted small-copy">기존 계정을 기존 ID 그대로 연결합니다. 연결한 뒤 해당 과목 목록에서 계정과 계획을 계속 관리할 수 있습니다.</p>
          {users.filter((user) => !user.subjectId || !subjectById.has(user.subjectId)).map((user) => {
            const editing = editingTeacher?.userId === user.id ? editingTeacher : null;
            return (
              <div className="subject-management-header" key={user.id}>
                <div>{user.displayName} · {user.loginIdentifier} · 기존 과목명: {user.subjectLabel || "없음"}</div>
                {editing ? (
                  <>
                    <label className="field"><span>연결할 과목 분류</span><select value={editing.subjectId} onChange={(event) => setEditingTeacher((current) => current ? { ...current, subjectId: event.target.value } : current)}>
                      <option value="">과목 분류 선택</option>
                      {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}{subject.activeForPlans ? "" : " (작성 대상 제외)"}</option>)}
                    </select></label>
                    <fieldset className="user-grade-field"><legend>담당 학년</legend><div className="user-grade-options">{TEACHING_GRADES.map((grade) => <label key={grade}><input type="checkbox" checked={editing.teachingGrades.includes(grade)} onChange={() => setEditingTeacher((current) => current ? { ...current, teachingGrades: updateGrade(current.teachingGrades, grade) } : current)} />{grade}학년</label>)}</div></fieldset>
                    <button className="secondary-button" type="button" disabled={busyId === user.id || !editing.subjectId || editing.teachingGrades.length === 0} onClick={() => void saveTeacher()}>분류 연결 저장</button>
                    <button className="text-button" type="button" onClick={() => setEditingTeacher(null)}>취소</button>
                  </>
                ) : (
                  <button className="secondary-button" type="button" onClick={() => setEditingTeacher({ userId: user.id, displayName: user.displayName, subjectId: "", teachingGrades: user.teachingGrades, active: user.active })}>과목 분류 연결</button>
                )}
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="panel">
        <h2 className="section-title first-section-title">임시 비밀번호 전달용 목록</h2>
        <p className="muted small-copy">비밀번호 변경 전이면서 보관 기간 안인 값만 표시됩니다. 선택한 계정 또는 전체를 복사해 직접 전달해 주세요.</p>
        {availablePasswordUsers.length === 0 ? <p className="notice">확인할 수 있는 임시 비밀번호가 없습니다. 해시만 남은 계정은 명시적으로 재발급해야 새 값을 확인할 수 있습니다.</p> : (
          <>
            <label><input type="checkbox" checked={selectedPasswords.length === availablePasswordUsers.length && availablePasswordUsers.length > 0} onChange={(event) => setSelectedPasswordUsers(event.target.checked ? availablePasswordUsers.map((user) => user.id) : [])} /> 전체 선택</label>
            <div className="save-actions">
              <button className="secondary-button" type="button" disabled={selectedPasswords.length === 0} onClick={() => void copySelectedPasswords()}>선택한 임시 비밀번호 복사</button>
              {copyMessage ? <p role="status" className="small-copy">{copyMessage}</p> : null}
            </div>
            {copyFallbackOpen ? <textarea aria-label="복사할 임시 비밀번호 목록" readOnly rows={Math.min(10, selectedPasswordUsers.length + 1)} value={copyFallbackText} onFocus={(event) => event.currentTarget.select()} /> : null}
          </>
        )}
      </section>

      {error ? <p role="alert" className="validation-error-box">{error}</p> : null}
      {message ? <p role="status" className="validation-success">{message}</p> : null}
    </div>
  );
}

export function createSelectedTemporaryPasswordCopyText(
  users: readonly TeacherAccountSummary[],
  selectedUserIds: readonly string[],
  subjectById: ReadonlyMap<string, SchoolSubject>,
): string | undefined {
  if (selectedUserIds.length === 0) return undefined;
  const usersById = new Map(users.map((user) => [user.id, user]));
  const selectedUsers: TeacherAccountSummary[] = [];
  for (const userId of selectedUserIds) {
    const user = usersById.get(userId);
    if (!user || !user.active || user.temporaryPasswordState !== "available" || !user.temporaryPassword) {
      return undefined;
    }
    selectedUsers.push(user);
  }

  return selectedUsers.map((user) => [
    user.displayName,
    subjectById.get(user.subjectId ?? "")?.name ?? user.subjectLabel,
    user.loginIdentifier,
    user.temporaryPassword,
  ].join("\t")).join("\n");
}

function formatTeachingGrades(grades: TeachingGrade[]): string {
  return grades.map((grade) => `${grade}학년`).join(", ");
}

function formatAccountStatus(user: TeacherAccountSummary): string {
  if (!user.active) return "사용 중지";
  if (!user.mustChangePassword) return "비밀번호 변경 완료";
  if (user.temporaryPasswordState === "available") return "초기 비밀번호 변경 필요";
  if (user.temporaryPasswordState === "expired") return "임시 비밀번호 기간 만료";
  return "비밀번호 재발급 필요";
}
