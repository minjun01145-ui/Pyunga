export type AiTextMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiTextRequest = {
  messages: readonly AiTextMessage[];
  temperature?: number;
};

export interface AiTextClient {
  generateText(request: AiTextRequest): Promise<string>;
}
