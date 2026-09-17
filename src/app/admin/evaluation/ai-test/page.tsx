import { AiTestWorkspace } from "@/modules/ai-review/ui";

export default function AiTestPage() {
  return (
    <main>
      <h1 className="page-title">AI 작동 테스트</h1>
      <p className="page-intro muted">
        설정된 AI 서비스에 간단한 메시지를 보내 응답 내용과 처리 시간을 확인합니다.
      </p>
      <AiTestWorkspace />
    </main>
  );
}
