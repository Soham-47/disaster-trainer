import type { LingBotRenderReceipt } from "../fire-training/runtime";
import type { LingBotFileRef, LingBotNavigationInput, LingBotRenderJob, LingBotSessionPort } from "./types";

export class MockLingBotSession implements LingBotSessionPort {
  private stream: MediaStream | null = null;
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
  async disconnect(): Promise<void> { this.stream = null; }

  private createStream(): MediaStream {
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 1280; canvas.height = 720;
      const context = canvas.getContext("2d");
      context?.fillRect(0, 0, canvas.width, canvas.height);
      if (typeof canvas.captureStream === "function") return canvas.captureStream(16);
    }
    return { getTracks: () => [] } as unknown as MediaStream;
  }
}
