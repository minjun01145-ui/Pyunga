import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOllamaJsonClientFromEnv,
  OllamaAiError,
  OllamaJsonClient,
} from "./ollama-json-client";

const originalEnvironment = {
  baseUrl: process.env.OLLAMA_BASE_URL,
  apiKey: process.env.OLLAMA_API_KEY,
  model: process.env.OLLAMA_MODEL,
};

afterEach(() => {
  restoreEnvironmentVariable("OLLAMA_BASE_URL", originalEnvironment.baseUrl);
  restoreEnvironmentVariable("OLLAMA_API_KEY", originalEnvironment.apiKey);
  restoreEnvironmentVariable("OLLAMA_MODEL", originalEnvironment.model);
});

describe("createOllamaJsonClientFromEnv", () => {
  it("requires an API key for direct Ollama Cloud requests", () => {
    process.env.OLLAMA_BASE_URL = "https://ollama.com/api";
    process.env.OLLAMA_MODEL = "gpt-oss:120b";
    delete process.env.OLLAMA_API_KEY;

    expect(() => createOllamaJsonClientFromEnv()).toThrowError(
      new OllamaAiError(
        "Ollama Cloud를 사용하려면 서버 환경변수 OLLAMA_API_KEY를 설정해야 합니다.",
      ),
    );
  });

  it("allows a local Ollama server without an API key", () => {
    process.env.OLLAMA_BASE_URL = "http://localhost:11434/api";
    process.env.OLLAMA_MODEL = "gemma3";
    delete process.env.OLLAMA_API_KEY;

    expect(createOllamaJsonClientFromEnv()).toBeInstanceOf(OllamaJsonClient);
  });
});

describe("OllamaJsonClient", () => {
  it("returns a plain text chat response without JSON parsing", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            message: { content: "정상적으로 연결되었습니다." },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const client = new OllamaJsonClient({
      baseUrl: "https://ollama.com/api/",
      model: "gpt-oss:120b",
      apiKey: "test-key",
      fetchImplementation,
    });

    const result = await client.generateText({
      messages: [{ role: "user", content: "연결 상태를 알려 주세요." }],
      temperature: 0.2,
    });

    expect(result).toBe("정상적으로 연결되었습니다.");
    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://ollama.com/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gpt-oss:120b",
          messages: [{ role: "user", content: "연결 상태를 알려 주세요." }],
          stream: false,
          options: { temperature: 0.2 },
        }),
      }),
    );
  });

  it("uses the configured thinking level", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response(JSON.stringify({ message: { content: "{}" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const client = new OllamaJsonClient({
      baseUrl: "https://ollama.com/api",
      model: "gpt-oss:120b",
      apiKey: "test-key",
      think: "low",
      fetchImplementation,
    });

    await client.generateJson({
      messages: [{ role: "user", content: "학사일정을 추출해 주세요." }],
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://ollama.com/api/chat",
      expect.objectContaining({
        body: JSON.stringify({
          model: "gpt-oss:120b",
          messages: [{ role: "user", content: "학사일정을 추출해 주세요." }],
          stream: false,
          think: "low",
          options: { temperature: 0 },
        }),
      }),
    );
  });

  it("aborts a request after the configured timeout", async () => {
    const fetchImplementation = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    const client = new OllamaJsonClient({
      baseUrl: "https://ollama.com/api",
      model: "gpt-oss:120b",
      apiKey: "test-key",
      timeoutMs: 5,
      fetchImplementation,
    });

    await expect(
      client.generateText({ messages: [{ role: "user", content: "응답해 주세요." }] }),
    ).rejects.toThrowError("Ollama 응답 시간이 초과되었습니다.");
  });
});

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
