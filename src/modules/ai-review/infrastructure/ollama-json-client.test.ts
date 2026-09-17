import { afterEach, describe, expect, it } from "vitest";

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

function restoreEnvironmentVariable(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
