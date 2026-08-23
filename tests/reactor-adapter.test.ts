import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";

vi.mock("@reactor-models/lingbot-world-2", () => {
  class FakeLingbotWorld2Model {
    private imageHandlers = new Set<() => void>();
    private promptHandlers = new Set<(message: { prompt: string }) => void>();
    private mainVideoHandler?: (track: unknown, stream: unknown) => void;
    private pauseHandlers = new Set<() => void>();
    private resumeHandlers = new Set<() => void>();
    private statusHandler?: (status: string) => void;
    private status = "waiting";
    private imageAccepted = false;
    private promptAccepted = false;

    onImageAccepted(handler: () => void) {
      this.imageHandlers.add(handler);
      return () => this.imageHandlers.delete(handler);
    }

    onPromptAccepted(handler: (message: { prompt: string }) => void) {
      this.promptHandlers.add(handler);
      return () => this.promptHandlers.delete(handler);
    }

    onConditionsReady() {}
    onGenerationStarted() {}
    onChunkComplete() {}
    onGenerationPaused(handler: () => void) {
      this.pauseHandlers.add(handler);
      return () => this.pauseHandlers.delete(handler);
    }
    onGenerationResumed(handler: () => void) {
      this.resumeHandlers.add(handler);
      return () => this.resumeHandlers.delete(handler);
    }
    onCommandError() {}
    on(event: string, handler: (value: unknown) => void) {
      if (event === "statusChanged") this.statusHandler = handler as (status: string) => void;
      return () => undefined;
    }

    off(event?: string) {
    }

    getStatus() {
      return this.status;
    }

    async connect() {
      setTimeout(() => {
        this.status = "ready";
        this.statusHandler?.("ready");
      }, 10);
    }

    async uploadFile() {
      if (this.status !== "ready") {
        throw new Error(`Cannot upload file, status is "${this.status}". Must be "ready".`);
      }
      return { id: "fake-reference-file" };
    }

    async setImage() {
      setTimeout(() => {
        this.imageAccepted = true;
        this.imageHandlers.forEach((handler) => handler());
      }, 10);
    }

    async setSeed() {}

    async setPrompt(input: { prompt: string }) {
      setTimeout(() => {
        this.promptAccepted = true;
        this.promptHandlers.forEach((handler) => handler(input));
      }, 10);
    }

    async start() {
      if (!this.imageAccepted) throw new Error("No image set. Call set_image first.");
      if (!this.promptAccepted) throw new Error("No prompt set. Call set_prompt first.");
      setTimeout(() => {
        this.mainVideoHandler?.({ kind: "video" }, { kind: "stream" });
      }, 25);
    }

    onMainVideo(handler: (track: unknown, stream: unknown) => void) {
      this.mainVideoHandler = handler;
    }

    async pause() {
      setTimeout(() => {
        this.pauseHandlers.forEach((handler) => handler());
      }, 10);
    }
    async resume() {
      setTimeout(() => {
        this.resumeHandlers.forEach((handler) => handler());
      }, 10);
    }
    async reset() {}
    async disconnect() {}
  }

  return { LingbotWorld2Model: FakeLingbotWorld2Model };
});

import { ReactorClient, REACTOR_TIMEOUTS } from "../lib/reactor/client";
import { POST as tokenRoute } from "../app/api/reactor-token/route";

describe("ReactorClient Adapter", () => {
  let client: ReactorClient;

  beforeEach(() => {
    client = new ReactorClient();
  });

  it("allows enough time for remote session negotiation and the first model frame", () => {
    expect(REACTOR_TIMEOUTS.CONNECT).toBeGreaterThanOrEqual(60_000);
    expect(REACTOR_TIMEOUTS.FIRST_FRAME).toBeGreaterThanOrEqual(60_000);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests a model-scoped Reactor token using the documented contract", async () => {
    const originalKey = process.env.REACTOR_API_KEY;
    process.env.REACTOR_API_KEY = "test-reactor-key";
    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: "jwt_test_token", expires_at: 123 }),
    });
    vi.stubGlobal("fetch", upstreamFetch);

    try {
      const response = await tokenRoute();
      const [, options] = upstreamFetch.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(options.headers["Reactor-API-Key"]).toBe("test-reactor-key");
      expect(body).toEqual({
        authorization_details: [
          {
            type: "session",
            resources: { models: { match: ["reactor/lingbot-world-2"] } },
            constraints: { max_sessions: 10 },
          },
        ],
      });
      expect(await response.json()).toMatchObject({ token: "jwt_test_token", mode: "live" });
    } finally {
      if (originalKey === undefined) delete process.env.REACTOR_API_KEY;
      else process.env.REACTOR_API_KEY = originalKey;
    }
  });

  it("should initialize with idle status", () => {
    expect(client.getStatus()).toBe("idle");
    expect(client.getMode()).toBe("live");
  });

  it("should reject token endpoint failure without activating fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/reactor-token")) {
        return Promise.resolve({
          ok: false,
          status: 502,
          json: async () => ({ error: "TOKEN_EXCHANGE_FAILED", mode: "fallback" }),
        });
      }
      return Promise.resolve({ ok: true, blob: async () => new Blob(["test"]) });
    }));

    await expect(client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Bedroom fire scenario prompt",
      seed: 12345,
      fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
    })).rejects.toThrow("Token exchange failed");

    expect(client.getMode()).toBe("live");
    expect(client.getStatus()).toBe("error");
    expect(client.getActiveFallbackAsset()).toBeNull();
    expect(client.getFallbackReason()).toContain("Token exchange failed");
  });

  it("waits for the first live model frame before resolving start", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/reactor-token")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ token: "jwt_test_token", mode: "live" }),
        });
      }
      return Promise.resolve({ ok: true, blob: async () => new Blob(["test"]) });
    }));

    let frameReceived = false;
    let settled = false;
    const startPromise = client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Bedroom fire scenario prompt",
      seed: 12345,
      fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
      onFrame: (frame) => {
        if (frame) frameReceived = true;
      },
    }).then(() => {
      settled = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(settled).toBe(false);

    await startPromise;
    expect(settled).toBe(true);
    expect(frameReceived).toBe(true);
    expect(client.getMode()).toBe("live");
    expect(client.getStatus()).toBe("generating");
    expect(client.getActiveFallbackAsset()).toBeNull();
  });

  it("waits for live pause and resume acknowledgements", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/reactor-token")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ token: "jwt_test_token", mode: "live" }),
        });
      }
      return Promise.resolve({ ok: true, blob: async () => new Blob(["test"]) });
    }));

    await client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Bedroom fire scenario prompt",
      seed: 12345,
      fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
    });

    const pausePromise = client.pause();
    await new Promise((resolve) => setTimeout(resolve, 2));
    expect(client.getStatus()).toBe("generating");
    await pausePromise;
    expect(client.getStatus()).toBe("paused");

    const resumePromise = client.resume();
    await new Promise((resolve) => setTimeout(resolve, 2));
    expect(client.getStatus()).toBe("paused");
    await resumePromise;
    expect(client.getStatus()).toBe("generating");
  });

  it("waits for prompt acceptance before resolving a live branch change", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/reactor-token")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ token: "jwt_test_token", mode: "live" }),
        });
      }
      return Promise.resolve({ ok: true, blob: async () => new Blob(["test"]) });
    }));

    await client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Bedroom fire scenario prompt",
      seed: 12345,
      fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
    });

    let settled = false;
    const promptPromise = client.applyPrompt("The closed door stays shut.").then(() => {
      settled = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    expect(settled).toBe(false);
    await promptPromise;
    expect(settled).toBe(true);
  });

  it("should transition to fallback mode when useFallback is called", async () => {
    let triggered = false;
    client.on("fallback_triggered", () => {
      triggered = true;
    });

    await client.useFallback("/fallbacks/fire-bedroom-orient.mp4");

    expect(client.getStatus()).toBe("fallback");
    expect(client.getMode()).toBe("fallback");
    expect(client.getActiveFallbackAsset()).toBe("/fallbacks/fire-bedroom-orient.mp4");
    expect(triggered).toBe(true);
  });

  it("should pause and resume stream cleanly", async () => {
    await client.useFallback("/fallbacks/fire-bedroom-orient.mp4");

    let pausedEventFired = false;
    let resumedEventFired = false;

    client.on("generation_paused", () => {
      pausedEventFired = true;
    });
    client.on("generation_resumed", () => {
      resumedEventFired = true;
    });

    await client.pause();
    expect(client.getStatus()).toBe("paused");
    expect(pausedEventFired).toBe(true);

    await client.resume();
    expect(client.getStatus()).toBe("generating");
    expect(resumedEventFired).toBe(true);
  });

  it("should store and retrieve captured decision frames", () => {
    const testFrame = "data:image/jpeg;base64,mockframedata";
    client.setCapturedFrame(testFrame);
    expect(client.getCapturedFrame()).toBe(testFrame);
  });

  it("should clear prompt, seed, captured frame, and status on reset()", async () => {
    client.setCapturedFrame("data:image/jpeg;base64,sample");
    await client.useFallback("/fallbacks/fire-bedroom-orient.mp4");

    await client.reset();

    expect(client.getStatus()).toBe("idle");
    expect(client.getMode()).toBe("live");
    expect(client.getCapturedFrame()).toBeNull();
    expect(client.getActiveFallbackAsset()).toBeNull();
  });

  it("should verify that fallback media assets and reference image exist on disk", () => {
    const rootDir = process.cwd();
    const manifestPath = path.join(rootDir, "public", "fallbacks", "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    const fallbackKeys = Object.keys(manifest.fallbacks);

    for (const key of fallbackKeys) {
      const assetRelativePath = manifest.fallbacks[key].asset;
      const fullPath = path.join(rootDir, "public", assetRelativePath.replace(/^\//, ""));
      expect(fs.existsSync(fullPath)).toBe(true);
    }

    const referenceImagePath = path.join(rootDir, "public", "references", "bedroom-fire.jpg");
    expect(fs.existsSync(referenceImagePath)).toBe(true);
  });

  it("does not claim live frames when token acquisition fails", async () => {
    let frameReceived = false;
    await expect(client.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Testing frame delivery",
      seed: 42,
      fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
      onFrame: (frame) => {
        if (frame) frameReceived = true;
      },
    })).rejects.toThrow();

    expect(client.getStatus()).toBe("error");
    expect(frameReceived).toBe(false);
  });
});
