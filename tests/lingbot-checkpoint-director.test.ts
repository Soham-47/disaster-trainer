import { describe, expect, it, vi } from "vitest";
import { CheckpointDirector } from "../lib/lingbot/checkpoint-director";
import type { LingBotSessionPort, LingBotSceneContract } from "../lib/lingbot/types";
import { createFireTrainingState } from "../lib/fire-training/reducer";

const scene: LingBotSceneContract = {
  id: "branch", seed: 77117, invariantPrompt: "same", branchPrompt: "open", requiredVisualFacts: [], forbiddenVisualFacts: [], cameraPose: [], attentionWindow: "small", maximumFirstFrameMs: 100,
};
const receipt = { jobId: 1, firstChunkIndex: 2, startedAt: 1, firstFrameAt: 2 };

function fakeSession(overrides: Partial<LingBotSessionPort> = {}): LingBotSessionPort {
  return {
    connect: vi.fn(), uploadReference: vi.fn(async () => ({ uploadId: "u", name: "frame.jpg", mimeType: "image/jpeg", size: 4 })), render: vi.fn(async () => receipt), applyDelta: vi.fn(), pauseAtChunkBoundary: vi.fn(), waitForNextChunk: vi.fn(), setNavigation: vi.fn(), stopNavigation: vi.fn(), getStream: vi.fn(() => null), disconnect: vi.fn(), ...overrides,
  } as unknown as LingBotSessionPort;
}

describe("CheckpointDirector", () => {
  it("stops navigation and pauses before uploading a checkpoint", async () => {
    const order: string[] = [];
    const session = fakeSession({
      stopNavigation: vi.fn(async () => { order.push("stop"); }),
      waitForNextChunk: vi.fn(async () => { order.push("chunk"); return 1; }),
      pauseAtChunkBoundary: vi.fn(async () => { order.push("pause"); }),
      uploadReference: vi.fn(async () => { order.push("upload"); return { uploadId: "u", name: "frame.jpg", mimeType: "image/jpeg", size: 4 }; }),
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["jpeg"], { type: "image/jpeg" }))));
    const director = new CheckpointDirector(session);
    await director.prepareCheckpoint({ id: "fire:decision", capture: () => "data:image/jpeg;base64,abc", seed: 42069, worldState: createFireTrainingState() });
    expect(order).toEqual(["stop", "chunk", "pause", "upload"]);
  });

  it("uploads a checkpoint only once and reuses its file reference", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["jpeg"], { type: "image/jpeg" }))));
    const session = fakeSession();
    const director = new CheckpointDirector(session);
    const first = await director.prepareCheckpoint({ id: "same", capture: () => "data:image/jpeg;base64,abc", seed: 1, worldState: createFireTrainingState() });
    const second = await director.prepareCheckpoint({ id: "same", capture: () => "data:image/jpeg;base64,different", seed: 2, worldState: createFireTrainingState() });
    expect(first).toBe(second);
    expect(session.uploadReference).toHaveBeenCalledTimes(1);
  });

  it("passes the same checkpoint and seed to both branches", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Blob(["jpeg"], { type: "image/jpeg" }))));
    const render = vi.fn(async () => receipt);
    const session = fakeSession({ render });
    const director = new CheckpointDirector(session);
    const checkpoint = await director.prepareCheckpoint({ id: "same", capture: () => "data:image/jpeg;base64,abc", seed: 1, worldState: createFireTrainingState() });
    await director.renderBranch({ kind: "branch", checkpoint, scene });
    await director.renderBranch({ kind: "alternative", checkpoint, scene: { ...scene, id: "safe", branchPrompt: "closed" } });
    const calls = render.mock.calls as unknown as Array<[ { checkpoint: unknown; scene: LingBotSceneContract } ]>;
    expect(calls[0]?.[0].checkpoint).toBe(checkpoint);
    expect(calls[1]?.[0].checkpoint).toBe(checkpoint);
    expect(calls[0]?.[0].scene.seed).toBe(calls[1]?.[0].scene.seed);
  });

  it("retries the same branch contract once after a timeout", async () => {
    const render = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce(receipt);
    const session = fakeSession({ render });
    const director = new CheckpointDirector(session);
    const checkpoint = { id: "same", frameDataUrl: "data:image/jpeg;base64,abc", uploadedFileRef: { uploadId: "u" }, seed: 1, worldState: createFireTrainingState(), createdAt: 1 } as never;
    await expect(director.renderBranch({ kind: "branch", checkpoint, scene })).resolves.toEqual(receipt);
    expect(render).toHaveBeenCalledTimes(2);
    expect(render.mock.calls[0][0]).toEqual(render.mock.calls[1][0]);
  });

  it("rejects receipts from a cancelled job", async () => {
    let resolveRender!: (value: typeof receipt) => void;
    const session = fakeSession({ render: vi.fn(() => new Promise<typeof receipt>((resolve) => { resolveRender = resolve; })) });
    const director = new CheckpointDirector(session);
    const checkpoint = { id: "same", frameDataUrl: "data:image/jpeg;base64,abc", uploadedFileRef: { uploadId: "u" }, seed: 1, worldState: createFireTrainingState(), createdAt: 1 } as never;
    const branch = director.renderBranch({ kind: "branch", checkpoint, scene });
    director.cancel();
    resolveRender(receipt);
    await expect(branch).rejects.toThrow(/cancelled/);
  });
});
