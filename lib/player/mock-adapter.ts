import type {
  WorldModelAdapter,
  WorldModelAdapterInput,
} from "@/lib/reactor/client";
import type { WorldModelStatus } from "@/lib/reactor/events";

type AdapterMode = "live" | "fallback";

/** Deterministic adapter used by the player UI and its tests. */
export class MockWorldModelAdapter implements WorldModelAdapter {
  private status: WorldModelStatus = "idle";
  private mode: AdapterMode = "live";
  private fallbackAsset: string | null = null;
  private frameCallback?: (frame: unknown) => void;
  private readonly listeners = new Set<(status: WorldModelStatus) => void>();
  private readonly delayMs: number;

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

