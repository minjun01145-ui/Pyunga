export type AiJsonMessage = {
  role: "system" | "user";
  content: string;
};

export type AiJsonRequest = {
  messages: readonly AiJsonMessage[];
  temperature?: number;
};

export interface AiJsonClient {
  generateJson(request: AiJsonRequest): Promise<unknown>;
}
