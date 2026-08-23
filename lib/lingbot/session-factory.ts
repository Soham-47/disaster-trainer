import { LingBotSession } from "./session";
import { MockLingBotSession } from "./mock-session";

export function shouldUseMock(search: string, nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production" && new URLSearchParams(search).get("mockWorld") === "1";
}

export function createLingBotSession(input: { allowMock: boolean; search: string }) {
  if (input.allowMock && shouldUseMock(input.search, process.env.NODE_ENV)) return new MockLingBotSession();
  return new LingBotSession();
}
