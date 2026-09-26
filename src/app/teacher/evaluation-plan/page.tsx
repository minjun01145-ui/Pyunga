import { EvaluationPlanWorkspace } from "@/modules/evaluation-plan/ui/EvaluationPlanWorkspace";
import { TeacherAccountMenu } from "@/modules/auth/ui/TeacherAccountMenu";

export default function EvaluationPlanPage() {
  return (
    <main>
      <TeacherAccountMenu />
      <EvaluationPlanWorkspace />
    </main>
  );
}
