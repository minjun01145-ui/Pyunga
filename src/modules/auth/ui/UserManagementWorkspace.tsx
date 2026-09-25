"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";

import {
  isAuthenticationDisabled,
  TEACHING_GRADES,
  type TeacherAccountSummary,
  type TeachingGrade,
} from "@/modules/auth";
import { authenticatedFetch } from "@/modules/auth/client";

type IssuedCredentials = {
  loginIdentifier: string;
  temporaryPassword: string;
  message: string;
};

export function UserManagementWorkspace() {
  const authenticationDisabled = isAuthenticationDisabled();
  const [users, setUsers] = useState<TeacherAccountSummary[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [subjectLabel, setSubjectLabel] = useState("");
  const [teachingGrades, setTeachingGrades] = useState<TeachingGrade[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editSubjectLabel, setEditSubjectLabel] = useState("");
  const [editTeachingGrades, setEditTeachingGrades] = useState<TeachingGrade[]>([]);
  const [issuedCredentials, setIssuedCredentials] = useState<IssuedCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!authenticationDisabled);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (authenticationDisabled) return;

    let cancelled = false;

    async function loadUsers() {
      try {
        const response = await authenticatedFetch("/api/admin/evaluation/users");
        const body = (await response.json().catch(() => null)) as
          | { users?: TeacherAccountSummary[]; error?: string }
          | null;
        if (!response.ok || !body?.users) {
          throw new Error(body?.error ?? "사용자 목록을 불러오지 못했습니다.");
        }
        if (!cancelled) setUsers(body.users);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "사용자 목록을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [authenticationDisabled]);

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIssuedCredentials(null);
    setIsSubmitting(true);

    try {
      const response = await authenticatedFetch("/api/admin/evaluation/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, subjectLabel, teachingGrades }),
      });
      const body = (await response.json().catch(() => null)) as
        | { user?: TeacherAccountSummary; temporaryPassword?: string; error?: string }
        | null;
      if (!response.ok || !body?.user || !body.temporaryPassword) {
        throw new Error(body?.error ?? "사용자 계정을 만들지 못했습니다.");
      }

      setUsers((current) =>
        [...current, body.user!].sort((left, right) =>
          left.loginIdentifier.localeCompare(right.loginIdentifier),
        ),
      );
      setIssuedCredentials({
        loginIdentifier: body.user.loginIdentifier,
        temporaryPassword: body.temporaryPassword,
        message: "사용자 계정을 만들었습니다.",
      });
      setDisplayName("");
      setSubjectLabel("");
      setTeachingGrades([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "사용자 계정을 만들지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(user: TeacherAccountSummary) {
    if (!window.confirm(`${user.displayName} 사용자의 비밀번호를 초기화할까요?`)) return;

    setError(null);
    setIssuedCredentials(null);
    setResettingUserId(user.id);
    try {
      const response = await authenticatedFetch(
        `/api/admin/evaluation/users/${encodeURIComponent(user.id)}/reset-password`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as
        | { temporaryPassword?: string; error?: string }
        | null;
      if (!response.ok || !body?.temporaryPassword) {
        throw new Error(body?.error ?? "비밀번호를 초기화하지 못했습니다.");
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, mustChangePassword: true } : item,
        ),
      );
      setIssuedCredentials({
        loginIdentifier: user.loginIdentifier,
        temporaryPassword: body.temporaryPassword,
        message: "비밀번호를 초기화했습니다.",
      });
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "비밀번호를 초기화하지 못했습니다.");
    } finally {
      setResettingUserId(null);
    }
  }

  function startEditing(user: TeacherAccountSummary) {
    setEditingUserId(user.id);
    setEditDisplayName(user.displayName);
    setEditSubjectLabel(user.subjectLabel);
    setEditTeachingGrades(user.teachingGrades);
  }

  async function saveTeacherAccount(
    user: TeacherAccountSummary,
    values: { displayName: string; subjectLabel: string; teachingGrades: TeachingGrade[]; active: boolean },
  ) {
    const response = await authenticatedFetch(`/api/admin/evaluation/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await response.json().catch(() => null) as
      | { user?: TeacherAccountSummary; error?: string }
      | null;
    const updatedUser = body?.user;
    if (!response.ok || !updatedUser) {
      throw new Error(body?.error ?? "담당 정보를 저장하지 못했습니다.");
    }
    setUsers((current) => current.map((item) => item.id === user.id ? updatedUser : item));
  }

  async function handleSaveTeacherAccount(event: FormEvent<HTMLFormElement>, user: TeacherAccountSummary) {
    event.preventDefault();
    if (editTeachingGrades.length === 0) {
      setError("담당 학년을 하나 이상 선택해 주세요.");
      return;
    }
    setError(null);
    setSavingUserId(user.id);
    try {
      await saveTeacherAccount(user, {
        displayName: editDisplayName,
        subjectLabel: editSubjectLabel,
        teachingGrades: editTeachingGrades,
        active: user.active,
      });
      setEditingUserId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "담당 정보를 저장하지 못했습니다.");
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleToggleTeacherActive(user: TeacherAccountSummary) {
    const nextActive = !user.active;
    if (!nextActive && !window.confirm(`${user.displayName} 계정을 사용 중지할까요?`)) return;
    setError(null);
    setSavingUserId(user.id);
    try {
      await saveTeacherAccount(user, {
        displayName: user.displayName,
        subjectLabel: user.subjectLabel,
        teachingGrades: user.teachingGrades,
        active: nextActive,
      });
      setEditingUserId(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "계정 상태를 변경하지 못했습니다.");
    } finally {
      setSavingUserId(null);
    }
  }

  function toggleGrade(grade: TeachingGrade) {
    setTeachingGrades((current) =>
      current.includes(grade)
        ? current.filter((item) => item !== grade)
        : [...current, grade].sort((left, right) => left - right),
    );
  }

  if (authenticationDisabled) {
    return (
      <p className="notice">
        사용자 관리는 관리자 로그인이 활성화된 환경에서 사용할 수 있습니다.
      </p>
    );
  }

  return (
    <div className="workspace-stack">
      <section className="panel">
        <h2 className="section-title first-section-title">사용자 추가</h2>
        <form className="form-grid three-columns" onSubmit={handleCreateUser}>
          <label className="field">
            <span>이름</span>
            <input
              type="text"
              maxLength={80}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>교과</span>
            <input
              type="text"
              maxLength={80}
              required
              value={subjectLabel}
              onChange={(event) => setSubjectLabel(event.target.value)}
            />
          </label>
          <fieldset className="field user-grade-field">
            <legend>수업 학년</legend>
            <div className="user-grade-options">
              {TEACHING_GRADES.map((grade) => (
                <label key={grade}>
                  <input
                    type="checkbox"
                    checked={teachingGrades.includes(grade)}
                    onChange={() => toggleGrade(grade)}
                  />
                  {grade}학년
                </label>
              ))}
            </div>
          </fieldset>
          <div className="save-actions">
            <button
              className="secondary-button"
              type="submit"
              disabled={isSubmitting || teachingGrades.length === 0}
            >
              {isSubmitting ? "추가 중" : "사용자 추가"}
            </button>
          </div>
        </form>
      </section>

      {issuedCredentials ? (
        <section className="notice credential-result" aria-live="polite">
          <strong>{issuedCredentials.message}</strong>
          <p>아이디: <strong>{issuedCredentials.loginIdentifier}</strong></p>
          <p>임시 비밀번호: <strong>{issuedCredentials.temporaryPassword}</strong></p>
          <p className="muted small-copy">임시 비밀번호는 이 화면에서 지금만 확인할 수 있으며, 사용자는 로그인 후 새 비밀번호로 변경합니다.</p>
        </section>
      ) : null}

      {error ? <p className="validation-error-box">{error}</p> : null}

      <section>
        <h2 className="section-title">사용자 목록</h2>
        {isLoading ? (
          <p className="muted">사용자 목록을 불러오고 있습니다.</p>
        ) : users.length === 0 ? (
          <p className="notice">등록된 사용자가 없습니다.</p>
        ) : (
          <div className="calendar-table-scroll">
            <table className="simple-table user-management-table">
              <thead>
                <tr>
                  <th>아이디</th>
                  <th>이름</th>
                  <th>교과</th>
                  <th>수업 학년</th>
                  <th>상태</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <Fragment key={user.id}>
                  <tr>
                    <td>{user.loginIdentifier}</td>
                    <td>{user.displayName}</td>
                    <td>{user.subjectLabel}</td>
                    <td>{formatTeachingGrades(user.teachingGrades)}</td>
                    <td>
                      {!user.active
                        ? "사용 중지"
                        : user.mustChangePassword
                          ? "비밀번호 변경 필요"
                          : "사용 중"}
                    </td>
                    <td>
                      <div className="user-account-actions">
                        <button className="text-button" type="button" onClick={() => startEditing(user)}>
                          담당 수정
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          disabled={resettingUserId === user.id}
                          onClick={() => void handleResetPassword(user)}
                        >
                          {resettingUserId === user.id ? "초기화 중" : "비밀번호 초기화"}
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          disabled={savingUserId === user.id}
                          onClick={() => void handleToggleTeacherActive(user)}
                        >
                          {user.active ? "사용 중지" : "다시 사용"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingUserId === user.id ? (
                    <tr>
                      <td colSpan={6}>
                        <form className="form-grid three-columns" onSubmit={(event) => void handleSaveTeacherAccount(event, user)}>
                          <label className="field">
                            <span>이름</span>
                            <input maxLength={80} required value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} />
                          </label>
                          <label className="field">
                            <span>교과</span>
                            <input maxLength={80} required value={editSubjectLabel} onChange={(event) => setEditSubjectLabel(event.target.value)} />
                          </label>
                          <fieldset className="field user-grade-field">
                            <legend>수업 학년</legend>
                            <div className="user-grade-options">
                              {TEACHING_GRADES.map((grade) => (
                                <label key={grade}>
                                  <input
                                    type="checkbox"
                                    checked={editTeachingGrades.includes(grade)}
                                    onChange={() => setEditTeachingGrades((current) => current.includes(grade)
                                      ? current.filter((item) => item !== grade)
                                      : [...current, grade].sort((left, right) => left - right))}
                                  />
                                  {grade}학년
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <div className="save-actions">
                            <button className="secondary-button" type="submit" disabled={savingUserId === user.id || editTeachingGrades.length === 0}>
                              {savingUserId === user.id ? "저장 중" : "담당 정보 저장"}
                            </button>
                            <button className="text-button" type="button" onClick={() => setEditingUserId(null)}>취소</button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatTeachingGrades(grades: TeachingGrade[]): string {
  return grades.map((grade) => `${grade}학년`).join(", ");
}
