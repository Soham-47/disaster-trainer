import type { FireTrainingState } from "../fire-training/reducer";
import type { LingBotRenderReceipt } from "../fire-training/runtime";
import { LingBotTransportError } from "./errors";
import type {
  LingBotCheckpoint,
  LingBotRenderJob,
  LingBotSceneContract,
  LingBotSessionPort,
} from "./types";

export class CheckpointDirector {
  private nextJobId = 1;
  private activeJobId: number | null = null;
  private cachedCheckpoint: LingBotCheckpoint | null = null;

  constructor(private readonly session: LingBotSessionPort) {}

  async prepareCheckpoint(input: {
    id: string;
    capture: () => string;
    seed: number;
    worldState: FireTrainingState;
  }): Promise<LingBotCheckpoint> {
    if (this.cachedCheckpoint?.id === input.id) return this.cachedCheckpoint;
    await this.session.stopNavigation();
    await this.session.waitForNextChunk();
    await this.session.pauseAtChunkBoundary();
    const frameDataUrl = input.capture();
    const response = await fetch(frameDataUrl);
    const uploadedFileRef = await this.session.uploadReference(await response.blob());
    this.cachedCheckpoint = {
      id: input.id,
      frameDataUrl,
      uploadedFileRef,
      seed: input.seed,
      worldState: structuredClone(input.worldState),
      createdAt: Date.now(),
    };
    return this.cachedCheckpoint;
  }

  async renderBranch(input: {
    kind: "branch" | "alternative";
    checkpoint: LingBotCheckpoint;
    scene: LingBotSceneContract;
  }): Promise<LingBotRenderReceipt> {
    const jobId = this.nextJobId++;
    this.activeJobId = jobId;
    const render = () => this.session.render({
      jobId,
      kind: input.kind,
      checkpoint: input.checkpoint,
      scene: input.scene,
    } satisfies LingBotRenderJob, input.checkpoint.uploadedFileRef);
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const receipt = await render();
          if (this.activeJobId !== jobId) throw new LingBotTransportError("LingBot branch render was cancelled");
          return receipt;
        } catch (error) {
          if (this.activeJobId !== jobId) throw new LingBotTransportError("LingBot branch render was cancelled", error);
          if (attempt === 1) throw error;
        }
      }
      throw new LingBotTransportError("LingBot branch render did not produce a receipt");
    } finally {
      if (this.activeJobId === jobId) this.activeJobId = null;
    }
  }

  cancel(): void {
    this.activeJobId = null;
  }
}
