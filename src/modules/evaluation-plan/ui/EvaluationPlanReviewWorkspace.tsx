"use client";

import { useEffect, useState } from "react";
import { authenticatedFetch } from "@/modules/auth/client";
import { buildRawEvaluationPlanDocument, RawEvaluationPlanDocument } from "@/modules/document-export";
import { EVALUATION_PLAN_STATUS_LABELS, type EvaluationPlanSummary, type SavedEvaluationPlan } from "../application/evaluation-plan-workflow";
import styles from "./EvaluationPlanReviewWorkspace.module.css";

export function EvaluationPlanReviewWorkspace() {
  const [plans, setPlans] = useState<EvaluationPlanSummary[]>([]);
  const [selected, setSelected] = useState<SavedEvaluationPlan | null>(null);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await authenticatedFetch("/api/admin/evaluation/plans");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "작성 현황을 불러오지 못했습니다.");
      setPlans(body.plans);
      setDemoMode(body.demoMode);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "작성 현황을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialPlans() {
      try {
        const response = await authenticatedFetch("/api/admin/evaluation/plans");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "작성 현황을 불러오지 못했습니다.");
        if (!cancelled) {
          setPlans(body.plans);
          setDemoMode(body.demoMode);
        }
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "작성 현황을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitialPlans();
    return () => { cancelled = true; };
  }, []);

  async function select(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/admin/evaluation/plans/${id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "평가계획을 불러오지 못했습니다.");
      setSelected(body.plan);
      setComment(body.plan.reviewComment);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "평가계획을 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function review(action: "approve" | "reject") {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const response = await authenticatedFetch(`/api/admin/evaluation/plans/${selected.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, comment, expectedRevision: selected.revision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "검토 결과를 저장하지 못했습니다.");
      const plan: SavedEvaluationPlan = body.plan;
      setSelected(plan);
      setPlans((current) => current.map((item) => item.id === plan.id ? plan : item));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "검토 결과를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  const visible = plans.filter((plan) => (!filter || plan.status === filter)
    && `${plan.context.subjectLabel} ${plan.teacherLabel} ${plan.context.academicYear} ${plan.context.grade}학년`.includes(search.trim()));

  return <div className="workspace-stack">
    <section className={`panel ${styles.controls}`}>
      <h1 className="page-title">평가계획 작성 현황·검토</h1>
      <p className="muted">저장된 교과 계획을 확인하고 제출된 계획을 승인하거나 반려합니다.</p>
      {demoMode ? <p className="notice">체험 모드에서는 교과 초안을 각 브라우저에 보관합니다. 제출·취합은 로그인 후 사용할 수 있습니다.</p> : null}
      <div className={styles.filters}>
        <label className="field"><span>학년도·교과·학년·담당자 검색</span><input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label className="field"><span>상태</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">전체</option>{Object.entries(EVALUATION_PLAN_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="secondary-button" type="button" disabled={loading || busy} onClick={() => { setSelected(null); void load(); }}>새로고침</button>
      </div>
      {error ? <p role="alert" className="validation-error-box">{error}</p> : null}
      {loading ? <p role="status">작성 현황을 불러오는 중입니다.</p> : <div className={styles.tableScroll}><table className="simple-table">
        <thead><tr><th>학년도·학기</th><th>교과</th><th>학년</th><th>담당자</th><th>상태</th><th>수정일</th><th>확인</th></tr></thead>
        <tbody>{visible.length ? visible.map((plan) => <tr key={plan.id}>
          <td>{plan.context.academicYear} · {plan.context.semester}학기</td><td>{plan.context.subjectLabel}</td><td>{plan.context.grade}학년</td><td>{plan.teacherLabel}</td><td>{EVALUATION_PLAN_STATUS_LABELS[plan.status]}</td><td>{new Date(plan.updatedAt).toLocaleString("ko-KR")}</td>
          <td><button className="secondary-button" type="button" disabled={busy} onClick={() => void select(plan.id)}>계획 확인</button></td>
        </tr>) : <tr><td colSpan={7}>표시할 평가계획이 없습니다.</td></tr>}</tbody>
      </table></div>}
    </section>
    {selected ? <>
      <section className={`panel ${styles.controls}`}>
        <h2 className="section-title">{selected.context.grade}학년 {selected.context.subjectLabel} · {EVALUATION_PLAN_STATUS_LABELS[selected.status]}</h2>
        <p className="muted">저장 당시의 양식과 학사일정이 적용된 문서입니다.</p>
        <label className="field"><span>검토 의견 (반려 시 필수)</span><textarea rows={3} maxLength={2000} value={comment} disabled={busy || selected.status !== "submitted"} onChange={(event) => setComment(event.target.value)} /></label>
        <div className={styles.filters}>
          {selected.status === "submitted" ? <>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => { if (window.confirm("이 평가계획을 승인하시겠습니까?")) void review("approve"); }}>승인</button>
            <button className="secondary-button" type="button" disabled={busy || !comment.trim()} onClick={() => void review("reject")}>반려</button>
          </> : null}
          <button className="secondary-button" type="button" disabled={busy} onClick={() => window.print()}>인쇄·PDF 저장</button>
          <button className="secondary-button" type="button" disabled={busy} onClick={() => void select(selected.id)}>제출본 다시 불러오기</button>
        </div>
      </section>
      <RawEvaluationPlanDocument view={buildRawEvaluationPlanDocument(selected.template, selected.draft, { teacherContext: selected.context, calendarEvents: selected.calendarEvents })} />
    </> : null}
  </div>;
}
