import type {
  WorldModelAdapter,
  WorldModelAdapterInput,
} from "@/lib/reactor/client";
import type { WorldModelStatus } from "@/lib/reactor/events";
import type { SceneSpec } from "@/lib/scenario/types";
import type { WorldModelNavigationInput } from "@/lib/reactor/client";

type AdapterMode = "live" | "fallback";

/** Deterministic adapter used by the player UI and its tests. */
export class MockWorldModelAdapter implements WorldModelAdapter {
  private status: WorldModelStatus = "idle";
  private mode: AdapterMode = "live";
  private fallbackAsset: string | null = null;
  private frameCallback?: (frame: unknown) => void;
  private readonly listeners = new Set<(status: WorldModelStatus) => void>();
  private readonly delayMs: number;
  private navigation: WorldModelNavigationInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    lookHorizontal: "idle",
    lookVertical: "idle",
  };

  constructor(delayMs = 120) {
    this.delayMs = delayMs;
  }

  getStatus(): WorldModelStatus {
    return this.status;
  }

  getMode(): AdapterMode {
    return this.mode;
  }

  getActiveFallbackAsset(): string | null {
    return this.fallbackAsset;
  }

  onStatus(listener: (status: WorldModelStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(input: WorldModelAdapterInput): Promise<void> {
    this.frameCallback = input.onFrame;
    this.mode = "live";
    this.fallbackAsset = null;
    this.setStatus("connecting");
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.setStatus("generating");
  }

  async pause(): Promise<void> {
    this.setStatus("paused");
  }

  async resume(): Promise<void> {
    if (this.status !== "paused") throw new Error("Cannot resume while the stream is not paused");
    this.setStatus("generating");
  }

  async applyPrompt(_prompt: string): Promise<void> {
    // The mock intentionally acknowledges prompt changes without simulating video.
  }

  async setNavigation(input: WorldModelNavigationInput): Promise<void> {
    this.navigation = { ...input };
  }

  async stopNavigation(): Promise<void> {
    await this.setNavigation({ forward: false, backward: false, left: false, right: false, lookHorizontal: "idle", lookVertical: "idle" });
  }

  async applySceneDelta(_scene: SceneSpec): Promise<void> {
    // The mock acknowledges deterministic scene changes without rendering video.
  }

  async captureCheckpoint(): Promise<string> {
    return "data:image/png;base64,mock-checkpoint";
  }

  async restartFromCheckpoint(input: { frameDataUrl: string; prompt: string; seed: number; attentionWindow: "small" | "large" | "auto"; fallbackAsset: string }): Promise<void> {
    await this.start({ referenceImage: input.frameDataUrl, prompt: input.prompt, seed: input.seed, fallbackAsset: input.fallbackAsset, onFrame: this.frameCallback, attentionWindow: input.attentionWindow });
  }

  async reset(): Promise<void> {
    this.mode = "live";
    this.fallbackAsset = null;
    this.frameCallback = undefined;
    this.setStatus("idle");
  }

  async useFallback(asset: string): Promise<void> {
    this.mode = "fallback";
    this.fallbackAsset = asset;
    this.frameCallback?.(null);
    this.setStatus("fallback");
  }

  private setStatus(status: WorldModelStatus): void {
    this.status = status;
    this.listeners.forEach((listener) => listener(status));
  }
}

