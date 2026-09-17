export type AiCallMetrics = {
  provider: string;
  model: string;
  elapsedMs: number;
  providerDurationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};
