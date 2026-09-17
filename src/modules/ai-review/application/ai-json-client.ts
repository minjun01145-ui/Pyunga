import type { AiCallMetrics } from "./ai-call-metrics";

export type AiJsonMessage = {
  role: "system" | "user";
  content: string;
};

export type AiJsonRequest = {
  messages: readonly AiJsonMessage[];
  temperature?: number;
};

export type AiJsonResult = {
  data: unknown;
  metrics: AiCallMetrics;
};

export interface AiJsonClient {
  generateJson(request: AiJsonRequest): Promise<AiJsonResult>;
}
