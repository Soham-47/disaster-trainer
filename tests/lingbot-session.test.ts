import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;

  const config = {
    autoReady: true,
    autoImage: true,
    autoPrompt: true,
    autoReset: true,
    autoPause: true,
    autoVideo: true,
    autoChunk: true,
    imageCommandError: false,
    imageCommandReject: false,
  };
  const instances: FakeLingbotWorld2Model[] = [];

  class FakeLingbotWorld2Model {
    status = "disconnected";
    commands: Array<{ name: string; payload?: unknown; waiters: number }> = [];
    disconnectCalled = false;
    private listeners = new Map<string, Set<Handler>>();

    constructor() {
      instances.push(this);
    }

    private subscribe(event: string, handler: Handler) {
      const handlers = this.listeners.get(event) ?? new Set<Handler>();
      handlers.add(handler);
      this.listeners.set(event, handlers);
      return () => handlers.delete(handler);
    }

    private record(name: string, payload?: unknown, waiterEvent?: string) {
      this.commands.push({
        name,
        payload,
        waiters: waiterEvent ? this.listenerCount(waiterEvent) : 0,
      });
    }

    emit(event: string, ...args: unknown[]) {
      for (const handler of [...(this.listeners.get(event) ?? [])]) handler(...args);
    }

    listenerCount(event?: string) {
      if (event) return this.listeners.get(event)?.size ?? 0;
      return [...this.listeners.values()].reduce((count, handlers) => count + handlers.size, 0);
    }

    on(event: string, handler: Handler) {
      this.subscribe(event, handler);
    }

    off(event: string, handler: Handler) {
      this.listeners.get(event)?.delete(handler);
    }

    onCommandError(handler: Handler) { return this.subscribe("command_error", handler); }
    onChunkComplete(handler: Handler) { return this.subscribe("chunk_complete", handler); }
    onImageAccepted(handler: Handler) { return this.subscribe("image_accepted", handler); }
    onPromptAccepted(handler: Handler) { return this.subscribe("prompt_accepted", handler); }
    onGenerationReset(handler: Handler) { return this.subscribe("generation_reset", handler); }
    onGenerationPaused(handler: Handler) { return this.subscribe("generation_paused", handler); }
    onMainVideo(handler: Handler) { return this.subscribe("main_video", handler); }

    getStatus() { return this.status; }

    async connect(token: string) {
      this.record("connect", token, "statusChanged");
      this.status = "connecting";
      if (config.autoReady) this.becomeReady();
    }

    becomeReady() {
      this.status = "ready";
      this.emit("statusChanged", "ready");
    }

    async uploadFile(source: Blob, options?: { name?: string }) {
      this.record("uploadFile", { source, options });
      return { uploadId: "upload-1", name: options?.name ?? "reference.jpg", mimeType: source.type, size: source.size };
    }

    async setSeed(payload: unknown) { this.record("setSeed", payload); }
    async setAttnWindow(payload: unknown) { this.record("setAttnWindow", payload); }
    async setCameraPose(payload: unknown) { this.record("setCameraPose", payload); }

    async setImage(payload: unknown) {
      this.record("setImage", payload, "image_accepted");
      if (config.imageCommandReject) throw new Error("data channel closed");
      if (config.imageCommandError) {
        this.emit("command_error", { type: "command_error", command: "set_image", reason: "decode failed" });
      } else if (config.autoImage) {
        this.emit("image_accepted", { type: "image_accepted", width: 1280, height: 720 });
      }
    }

    async setPrompt(payload: unknown) {
      this.record("setPrompt", payload, "prompt_accepted");
      if (config.autoPrompt) this.emit("prompt_accepted", { type: "prompt_accepted", prompt: "accepted" });
    }

    async start() {
      this.record("start", undefined, "main_video");
      if (config.autoVideo) this.emit("main_video", { kind: "track" }, { id: "stream-1" });
      if (config.autoChunk) this.emitChunk(0);
    }

    async reset() {
      this.record("reset", undefined, "generation_reset");
      if (config.autoReset) this.emit("generation_reset", { type: "generation_reset", reason: "requested" });
    }

    async pause() {
      this.record("pause", undefined, "generation_paused");
      if (config.autoPause) this.emit("generation_paused", { type: "generation_paused", chunk_index: 0 });
    }

    async setMoveLongitudinal(payload: unknown) { this.record("setMoveLongitudinal", payload); }
    async setMoveLateral(payload: unknown) { this.record("setMoveLateral", payload); }
    async setLookHorizontal(payload: unknown) { this.record("setLookHorizontal", payload); }
    async setLookVertical(payload: unknown) { this.record("setLookVertical", payload); }

    async disconnect() {
      this.record("disconnect");
      this.disconnectCalled = true;
      this.status = "disconnected";
    }

    emitImage() {
      this.emit("image_accepted", { type: "image_accepted", width: 1280, height: 720 });
    }

    emitPrompt(prompt = "accepted") {
      this.emit("prompt_accepted", { type: "prompt_accepted", prompt });
    }

    emitVideo() {
      this.emit("main_video", { kind: "track" }, { id: "stream-1" });
    }

    emitChunk(chunkIndex: number) {
      this.emit("chunk_complete", {
        type: "chunk_complete",
        chunk_index: chunkIndex,
        active_action: "still",
        active_prompt: "accepted",
        frames_emitted: 16,
      });
    }
  }

  return { config, instances, FakeLingbotWorld2Model };
});

vi.mock("@reactor-models/lingbot-world-2", () => ({
  LingbotWorld2Model: sdk.FakeLingbotWorld2Model,
}));

import { LingBotCommandError, LingBotTimeoutError, LingBotTransportError } from "../lib/lingbot/errors";
import { LingBotSession } from "../lib/lingbot/session";
import type { LingBotFileRef, LingBotRenderJob } from "../lib/lingbot/types";

const reference = {
  uploadId: "checkpoint-upload",
  name: "checkpoint.jpg",
  mimeType: "image/jpeg",
  size: 123,
} as LingBotFileRef;

function makeJob(overrides: Partial<LingBotRenderJob> = {}): LingBotRenderJob {
  return {
    jobId: 7,
    kind: "initial",
    checkpoint: null,
    scene: {
      id: "bedroom-fire",
      seed: 31415,
      invariantPrompt: "Keep the same bedroom and learner viewpoint.",
      branchPrompt: "Smoke gathers behind the closed door.",
      requiredVisualFacts: ["closed door"],
      forbiddenVisualFacts: ["prepared footage"],
      cameraPose: [],
      attentionWindow: "small",
      maximumFirstFrameMs: 100,
    },
    ...overrides,
  };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

async function connectedSession() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ token: "jwt-test", mode: "live" }),
  }));
  const session = new LingBotSession();
  await session.connect();
  return { session, model: sdk.instances.at(-1)! };
}

describe("LingBotSession", () => {
  beforeEach(() => {
    sdk.instances.length = 0;
    Object.assign(sdk.config, {
      autoReady: true,
      autoImage: true,
      autoPrompt: true,
      autoReset: true,
      autoPause: true,
      autoVideo: true,
      autoChunk: true,
      imageCommandError: false,
      imageCommandReject: false,
    });
    vi.unstubAllGlobals();
  });

  it("does not resolve initial render before image, prompt, video and first chunk are confirmed", async () => {
    sdk.config.autoImage = false;
    sdk.config.autoPrompt = false;
    sdk.config.autoVideo = false;
    sdk.config.autoChunk = false;
    const { session, model } = await connectedSession();
    let receipt: unknown;
    const rendering = session.render(makeJob(), reference).then((value) => { receipt = value; });

    await vi.waitFor(() => expect(model.commands.at(-1)?.name).toBe("setImage"));
    expect(receipt).toBeUndefined();
    model.emitImage();
    await vi.waitFor(() => expect(model.commands.at(-1)?.name).toBe("setPrompt"));
    expect(receipt).toBeUndefined();
    model.emitPrompt();
    await vi.waitFor(() => expect(model.commands.at(-1)?.name).toBe("start"));
    expect(receipt).toBeUndefined();
    model.emitVideo();
    await flush();
    expect(receipt).toBeUndefined();
    model.emitChunk(3);

    await rendering;
    expect(receipt).toMatchObject({ jobId: 7, firstChunkIndex: 3 });
    expect(session.getStream()).toEqual({ id: "stream-1" });
  });

  it("registers event waiters before issuing their commands", async () => {
    const { session, model } = await connectedSession();

    await session.render(makeJob({ kind: "branch" }), reference);

    for (const command of model.commands.filter(({ name }) => ["reset", "setImage", "setPrompt", "start"].includes(name))) {
      expect(command.waiters, `${command.name} waiter count`).toBeGreaterThan(0);
    }
  });

  it("sends no navigation command before SDK status ready", async () => {
    sdk.config.autoReady = false;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "jwt-test", mode: "live" }) }));
    const session = new LingBotSession();
    const connecting = session.connect();
    await vi.waitFor(() => expect(sdk.instances).toHaveLength(1));
    const model = sdk.instances.at(-1)!;

    await session.setNavigation({
      forward: true,
      backward: false,
      left: false,
      right: false,
      lookHorizontal: "right",
      lookVertical: "up",
    });
    expect(model.commands.filter(({ name }) => name.startsWith("setMove") || name.startsWith("setLook"))).toEqual([]);

    model.becomeReady();
    await connecting;
    await session.setNavigation({
      forward: true,
      backward: false,
      left: false,
      right: true,
      lookHorizontal: "right",
      lookVertical: "up",
    });
    expect(model.commands.filter(({ name }) => name.startsWith("setMove") || name.startsWith("setLook"))).toHaveLength(4);
  });

  it("resets and restarts with the supplied file reference and seed", async () => {
    const { session, model } = await connectedSession();

    await session.render(makeJob({ kind: "alternative" }), reference);

    const renderCommands = model.commands.filter(({ name }) =>
      ["reset", "setSeed", "setAttnWindow", "setImage", "setPrompt", "start"].includes(name));
    expect(renderCommands.map(({ name }) => name)).toEqual([
      "reset",
      "setSeed",
      "setAttnWindow",
      "setImage",
      "setPrompt",
      "start",
    ]);
    expect(renderCommands[1].payload).toEqual({ seed: 31415 });
    expect(renderCommands[3].payload).toEqual({ image: reference });
  });

  it("applies a bounded prompt and camera delta at a chunk boundary", async () => {
    sdk.config.autoChunk = false;
    const { session, model } = await connectedSession();
    let receipt: unknown;

    const applying = session.applyDelta({
      jobId: 11,
      prompt: "The closed door contains the smoke.",
      cameraPose: [0, 0, 0, 0, 0, -1],
      attentionWindow: "small",
    }).then((value) => { receipt = value; });
    await vi.waitFor(() => expect(model.commands.at(-1)?.name).toBe("setPrompt"));

    expect(model.commands.slice(-3).map(({ name }) => name)).toEqual(["setAttnWindow", "setCameraPose", "setPrompt"]);
    expect(model.commands.at(-1)?.payload).toEqual({ prompt: "The closed door contains the smoke." });
    expect(receipt).toBeUndefined();
    model.emitChunk(6);
    await applying;
    expect(receipt).toMatchObject({ jobId: 11, firstChunkIndex: 6 });
  });

  it("rejects command_error instead of activating fallback media", async () => {
    sdk.config.imageCommandError = true;
    const { session } = await connectedSession();

    await expect(session.render(makeJob(), reference)).rejects.toMatchObject({
      code: "LINGBOT_COMMAND_ERROR",
      command: "set_image",
    });
    await expect(session.render(makeJob(), reference)).rejects.toBeInstanceOf(LingBotCommandError);
    expect("useFallback" in session).toBe(false);
  });

  it("rejects first-frame timeout without fabricating a render receipt", async () => {
    sdk.config.autoVideo = false;
    const { session } = await connectedSession();

    const rendering = session.render(makeJob({
      scene: { ...makeJob().scene, maximumFirstFrameMs: 5 },
    }), reference);

    await expect(rendering).rejects.toBeInstanceOf(LingBotTimeoutError);
    await expect(session.getStream()).toBeNull();
  });

  it("wraps SDK command rejection as a stable transport error", async () => {
    sdk.config.imageCommandReject = true;
    const { session } = await connectedSession();

    const rendering = session.render(makeJob(), reference);

    await expect(rendering).rejects.toBeInstanceOf(LingBotTransportError);
    await expect(rendering).rejects.toMatchObject({ code: "LINGBOT_TRANSPORT_ERROR" });
  });

  it("sends all four navigation axes to idle during stopNavigation", async () => {
    const { session, model } = await connectedSession();

    await session.stopNavigation();

    expect(model.commands.slice(-4)).toEqual([
      { name: "setMoveLongitudinal", payload: { move_longitudinal: "idle" }, waiters: 0 },
      { name: "setMoveLateral", payload: { move_lateral: "idle" }, waiters: 0 },
      { name: "setLookHorizontal", payload: { look_horizontal: "idle" }, waiters: 0 },
      { name: "setLookVertical", payload: { look_vertical: "idle" }, waiters: 0 },
    ]);
  });

  it("waits for a chunk boundary and SDK pause acknowledgement", async () => {
    sdk.config.autoPause = false;
    const { session, model } = await connectedSession();
    let paused = false;
    const pausing = session.pauseAtChunkBoundary().then(() => { paused = true; });
    await flush();

    expect(model.commands.some(({ name }) => name === "pause")).toBe(false);
    model.emitChunk(8);
    await flush();
    expect(model.commands.at(-1)?.name).toBe("pause");
    expect(paused).toBe(false);
    model.emit("generation_paused", { type: "generation_paused", chunk_index: 8 });
    await pausing;
    expect(paused).toBe(true);
  });

  it("disconnects and removes every SDK subscription", async () => {
    const { session, model } = await connectedSession();
    expect(model.listenerCount()).toBeGreaterThan(0);

    await session.disconnect();

    expect(model.disconnectCalled).toBe(true);
    expect(model.listenerCount()).toBe(0);
    expect(session.getStream()).toBeNull();
  });
});
