import type { AiCallMetrics } from "../application/ai-call-metrics";

type AiCallMetricsPanelProps = {
  metrics: AiCallMetrics;
};

export function AiCallMetricsPanel({ metrics }: AiCallMetricsPanelProps) {
  return (
    <section className="panel ai-call-metrics-panel" aria-labelledby="ai-call-metrics-title">
      <h2 className="subsection-title" id="ai-call-metrics-title">
        AI 호출 결과
      </h2>
      <dl className="ai-call-metrics-grid">
        <Metric label="서비스" value={metrics.provider} />
        <Metric label="모델" value={metrics.model} />
        <Metric label="AI 응답 대기 시간" value={formatDuration(metrics.elapsedMs)} />
        <Metric
          label="Ollama 처리 시간"
          value={formatOptionalDuration(metrics.providerDurationMs)}
        />
        <Metric label="입력 토큰" value={formatOptionalCount(metrics.inputTokens)} />
        <Metric label="출력 토큰" value={formatOptionalCount(metrics.outputTokens)} />
        <Metric label="전체 토큰" value={formatOptionalCount(metrics.totalTokens)} />
      </dl>
      <p className="muted small-copy ai-call-metrics-note">
        응답 대기 시간은 서버에서 Ollama API를 호출한 시점부터 응답을 받은 시점까지이며, Ollama
        처리 시간과 토큰 수는 Ollama 응답값입니다.
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) {
    return `${Math.round(milliseconds)}ms`;
  }

  return `${(milliseconds / 1_000).toFixed(2)}초`;
}

function formatOptionalDuration(milliseconds?: number): string {
  return milliseconds === undefined ? "제공되지 않음" : formatDuration(milliseconds);
}

function formatOptionalCount(count?: number): string {
  return count === undefined ? "제공되지 않음" : `${count.toLocaleString("ko-KR")} 토큰`;
}
