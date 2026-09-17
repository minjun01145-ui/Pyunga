import { EvaluationTemplateSectionWorkspace } from "@/modules/template/ui";

export default function EvaluationTemplateMajorSectionsPage() {
  return (
    <main>
      <h1 className="page-title">대분류 관리</h1>
      <p className="page-intro muted">
        전년도 평가계획을 불러와 문서의 대분류와 하위 제목 구조를 확인하고 학교 평가계획 양식으로 저장합니다.
      </p>
      <EvaluationTemplateSectionWorkspace />
    </main>
  );
}
