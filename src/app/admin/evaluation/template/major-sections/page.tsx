import { EvaluationTemplateSectionWorkspace } from "@/modules/template/ui";

export default function EvaluationTemplateMajorSectionsPage() {
  return (
    <main>
      <h1 className="page-title">대분류 관리</h1>
      <p className="page-intro muted">
        전년도 평가계획을 불러와 학교 공통 문서 구조와 교과별로 달라지는 반복 항목을 구분한 뒤 평가계획 양식으로 저장합니다.
      </p>
      <EvaluationTemplateSectionWorkspace />
    </main>
  );
}
