import type { LingBotRenderReceipt } from "../fire-training/runtime";
import type { LingBotFileRef, LingBotNavigationInput, LingBotRenderJob, LingBotSessionPort } from "./types";

export class MockLingBotSession implements LingBotSessionPort {
  private stream: MediaStream | null = null;
  private animationTimer: ReturnType<typeof setInterval> | null = null;
  readonly renders: LingBotRenderJob[] = [];
  readonly references: LingBotFileRef[] = [];
  private nextUpload = 1;

  async connect(): Promise<void> { this.stream = this.createStream(); }
  async uploadReference(source: Blob): Promise<LingBotFileRef> {
    const ref = { uploadId: `mock-upload-${this.nextUpload++}`, name: "reference.jpg", mimeType: source.type || "image/jpeg", size: source.size } as LingBotFileRef;
    this.references.push(ref);
    return ref;
  }
  async render(job: LingBotRenderJob, _reference: LingBotFileRef): Promise<LingBotRenderReceipt> {
    this.renders.push(job);
    await Promise.resolve();
    if (!this.stream) this.stream = this.createStream();
    return { jobId: job.jobId, firstChunkIndex: this.renders.length, startedAt: Date.now(), firstFrameAt: Date.now() };
  }
  async applyDelta(input: { jobId: number; prompt: string; cameraPose: number[]; attentionWindow: "small" | "large" | "auto" }): Promise<LingBotRenderReceipt> {
    await Promise.resolve();
    return { jobId: input.jobId, firstChunkIndex: this.renders.length + 1, startedAt: Date.now(), firstFrameAt: Date.now() };
  }
  async pauseAtChunkBoundary(): Promise<void> { await Promise.resolve(); }
  async waitForNextChunk(): Promise<number> { return 0; }
  async setNavigation(_input: LingBotNavigationInput): Promise<void> { await Promise.resolve(); }
  async stopNavigation(): Promise<void> { await Promise.resolve(); }
  getStream(): MediaStream | null { return this.stream; }
  async disconnect(): Promise<void> {
    if (this.animationTimer) clearInterval(this.animationTimer);
    this.animationTimer = null;
    this.stream = null;
  }

  private createStream(): MediaStream {
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 1280; canvas.height = 720;
      const context = canvas.getContext("2d");
      context?.fillRect(0, 0, canvas.width, canvas.height);
      if (typeof canvas.captureStream === "function") {
        const stream = canvas.captureStream(16);
        // Canvas capture streams only publish a frame after the canvas changes.
        // Keep the mock video alive so checkpoint capture and branch UI tests
        // exercise the same ready-state path as a live stream.
        this.animationTimer = setInterval(() => {
          if (!context) return;
          context.fillStyle = "#050505";
          context.fillRect(0, 0, 2, 2);
        }, 100);
        return stream;
      }
    }
    return { getTracks: () => [] } as unknown as MediaStream;
  }
}
