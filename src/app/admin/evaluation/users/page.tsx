import { UserManagementWorkspace } from "@/modules/auth/ui/UserManagementWorkspace";

export default function EvaluationUserManagementPage() {
  return (
    <main>
      <h1 className="page-title">사용자 관리</h1>
      <p className="muted page-intro">
        교사 계정을 발급하고 담당 교과와 수업 학년을 관리합니다.
      </p>
      <UserManagementWorkspace />
    </main>
  );
}
