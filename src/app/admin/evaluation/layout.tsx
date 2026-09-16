import { EvaluationAdminSidebar } from "./_components/EvaluationAdminSidebar";

export default function EvaluationAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="evaluation-admin-layout">
      <EvaluationAdminSidebar />
      <div className="evaluation-admin-content">{children}</div>
    </div>
  );
}
