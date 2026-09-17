import type { AiCallMetrics } from "../application/ai-call-metrics";
import type { AiJsonClient, AiJsonRequest, AiJsonResult } from "../application/ai-json-client";
import type { AiTextClient, AiTextRequest } from "../application/ai-text-client";

type OllamaJsonClientOptions = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  think?: boolean | "low" | "medium" | "high";
  fetchImplementation?: typeof fetch;
};

type OllamaClientEnvironmentOptions = Pick<OllamaJsonClientOptions, "timeoutMs" | "think">;

type OllamaChatResponse = {
  model?: unknown;
  message?: {
    content?: unknown;
  };
  total_duration?: unknown;
  prompt_eval_count?: unknown;
  eval_count?: unknown;
  error?: unknown;
};

type OllamaContentResult = {
  content: string;
  metrics: AiCallMetrics;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export class OllamaAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaAiError";
  }
}

export class OllamaJsonClient implements AiJsonClient, AiTextClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly think?: boolean | "low" | "medium" | "high";
  private readonly fetchImplementation: typeof fetch;

  constructor(options: OllamaJsonClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.think = options.think;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async generateJson(request: AiJsonRequest): Promise<AiJsonResult> {
    const result = await this.requestContent(request);
    return {
      data: parseJsonContent(result.content),
      metrics: result.metrics,
    };
  }

  async generateText(request: AiTextRequest): Promise<string> {
    return (await this.requestContent(request)).content;
  }

  private async requestContent(request: AiTextRequest): Promise<OllamaContentResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const response = await this.fetchImplementation(`${this.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          stream: false,
          ...(this.think === undefined ? {} : { think: this.think }),
          options: {
            temperature: request.temperature ?? 0,
          },
        }),
        signal: controller.signal,
      });

      const responseBody = (await response.json().catch(() => null)) as OllamaChatResponse | null;

      if (!response.ok) {
        const detail = typeof responseBody?.error === "string" ? `: ${responseBody.error}` : "";
        throw new OllamaAiError(`Ollama 요청에 실패했습니다 (${response.status})${detail}`);
      }

      const content = responseBody?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new OllamaAiError("Ollama 응답에 message.content가 없습니다.");
      }

      return {
        content: content.trim(),
        metrics: buildCallMetrics({
          responseBody: responseBody ?? {},
          configuredModel: this.model,
          elapsedMs: Date.now() - startedAt,
          isCloud: isOllamaCloudUrl(this.baseUrl),
        }),
      };
    } catch (error) {
      if (error instanceof OllamaAiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new OllamaAiError("Ollama 응답 시간이 초과되었습니다.");
      }

      throw new OllamaAiError(error instanceof Error ? error.message : "Ollama 요청 중 오류가 발생했습니다.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildCallMetrics(params: {
  responseBody: OllamaChatResponse;
  configuredModel: string;
  elapsedMs: number;
  isCloud: boolean;
}): AiCallMetrics {
  const inputTokens = readNonNegativeInteger(params.responseBody.prompt_eval_count);
  const outputTokens = readNonNegativeInteger(params.responseBody.eval_count);

  return {
    provider: params.isCloud ? "Ollama Cloud" : "Ollama",
    model:
      typeof params.responseBody.model === "string" && params.responseBody.model.trim().length > 0
        ? params.responseBody.model.trim()
        : params.configuredModel,
    elapsedMs: Math.max(0, params.elapsedMs),
    providerDurationMs: nanosecondsToMilliseconds(params.responseBody.total_duration),
    inputTokens,
    outputTokens,
    totalTokens:
      inputTokens === undefined || outputTokens === undefined
        ? undefined
        : inputTokens + outputTokens,
  };
}

function nanosecondsToMilliseconds(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return Math.round(value / 100_000) / 10;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(withoutFence) as unknown;
  } catch {
    const objectStart = withoutFence.indexOf("{");
    const objectEnd = withoutFence.lastIndexOf("}");

    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        return JSON.parse(withoutFence.slice(objectStart, objectEnd + 1)) as unknown;
      } catch {
        // Fall through to the stable error below.
      }
    }
  }

  throw new OllamaAiError("Ollama가 유효한 JSON을 반환하지 않았습니다.");
}

export function createOllamaJsonClientFromEnv(
  options: OllamaClientEnvironmentOptions = {},
): OllamaJsonClient {
  const model = process.env.OLLAMA_MODEL?.trim();
  if (!model) {
    throw new OllamaAiError("서버 환경변수 OLLAMA_MODEL이 설정되지 않았습니다.");
  }

  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "https://ollama.com/api";
  const apiKey = process.env.OLLAMA_API_KEY?.trim();
  if (isOllamaCloudUrl(baseUrl) && !apiKey) {
    throw new OllamaAiError("Ollama Cloud를 사용하려면 서버 환경변수 OLLAMA_API_KEY를 설정해야 합니다.");
  }

  return new OllamaJsonClient({
    baseUrl,
    model,
    apiKey,
    timeoutMs: options.timeoutMs,
    think: options.think,
  });
}

export function createOllamaTextClientFromEnv(): AiTextClient {
  return createOllamaJsonClientFromEnv();
}

function isOllamaCloudUrl(value: string): boolean {
  try {
    return new URL(value).hostname === "ollama.com";
  } catch {
    return false;
  }
}
