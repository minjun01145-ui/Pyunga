"use client";

import { useState, type FormEvent } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  durationMs?: number;
};

type AiTestResponse = {
  answer?: string;
  durationMs?: number;
  error?: string;
};

export function AiTestWorkspace() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = input.trim();
    if (!content || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/evaluation/ai-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.slice(-12).map(({ role, content: messageContent }) => ({
            role,
            content: messageContent,
          })),
        }),
      });
      const body = (await response.json()) as AiTestResponse;

      if (!response.ok || typeof body.answer !== "string" || typeof body.durationMs !== "number") {
        throw new Error(body.error || "AI 응답을 확인하지 못했습니다.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: body.answer ?? "",
          durationMs: body.durationMs,
        },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI 요청에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="panel ai-test-panel">
      <div className="ai-chat-log" aria-live="polite" aria-label="AI 대화 내용">
        {messages.length === 0 ? (
          <p className="muted ai-chat-empty">메시지를 보내면 이곳에 AI 응답과 처리 시간이 표시됩니다.</p>
        ) : (
          messages.map((message) => (
            <article className={`ai-chat-message ${message.role}`} key={message.id}>
              <strong>{message.role === "user" ? "질문" : "AI 응답"}</strong>
              <p>{message.content}</p>
              {message.durationMs !== undefined ? (
                <span className="muted small-copy">응답 시간 {formatDuration(message.durationMs)}</span>
              ) : null}
            </article>
          ))
        )}
        {isLoading ? <p className="muted ai-chat-status">AI 응답을 기다리는 중입니다.</p> : null}
      </div>

      {error ? <p className="validation-error-box">{error}</p> : null}

      <form className="ai-chat-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>메시지</span>
          <textarea
            rows={4}
            maxLength={2_000}
            value={input}
            placeholder="AI 연결을 확인할 질문을 입력하세요."
            onChange={(event) => setInput(event.target.value)}
          />
        </label>
        <div className="ai-chat-form-footer">
          <span className="muted small-copy">{input.length.toLocaleString()} / 2,000자</span>
          <button className="secondary-button" type="submit" disabled={isLoading || !input.trim()}>
            {isLoading ? "응답 대기 중" : "메시지 보내기"}
          </button>
        </div>
      </form>
    </section>
  );
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1_000).toFixed(2)}초`;
}
