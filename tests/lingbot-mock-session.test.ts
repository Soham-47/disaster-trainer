import { describe, expect, it } from "vitest";
import { MockLingBotSession } from "../lib/lingbot/mock-session";
import { createLingBotSession, shouldUseMock } from "../lib/lingbot/session-factory";

describe("LingBot mock session", () => {
  it("returns the real session by default", () => {
    expect(createLingBotSession({ allowMock: true, search: "" }).constructor.name).toBe("LingBotSession");
  });
  it("returns the mock only outside production with mockWorld=1", () => {
    expect(shouldUseMock("?mockWorld=1", "development")).toBe(true);
    expect(createLingBotSession({ allowMock: true, search: "?mockWorld=1" })).toBeInstanceOf(MockLingBotSession);
  });
  it("refuses mockWorld=1 in production", () => {
    expect(shouldUseMock("?mockWorld=1", "production")).toBe(false);
  });
  it("emits a stream and receipt for each branch job", async () => {
    const session = new MockLingBotSession();
    await session.connect();
    const ref = await session.uploadReference(new Blob(["x"], { type: "image/jpeg" }));
    const scene = { id: "a", seed: 1, invariantPrompt: "same", branchPrompt: "delta", requiredVisualFacts: [], forbiddenVisualFacts: [], cameraPose: [], attentionWindow: "small" as const, maximumFirstFrameMs: 10 };
    const first = await session.render({ jobId: 1, kind: "branch", checkpoint: null, scene }, ref);
    const second = await session.render({ jobId: 2, kind: "alternative", checkpoint: null, scene: { ...scene, id: "b" } }, ref);
    expect(first.jobId).toBe(1);
    expect(second.jobId).toBe(2);
    expect(session.getStream()).not.toBeNull();
  });
});
