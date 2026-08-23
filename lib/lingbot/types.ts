import type { LingbotWorld2Model } from "@reactor-models/lingbot-world-2";
import type { FireTrainingState } from "../fire-training/reducer";
import type { LingBotRenderReceipt } from "../fire-training/runtime";

export type LingBotNavigationInput = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  lookHorizontal: "left" | "right" | "idle";
  lookVertical: "up" | "down" | "idle";
};

export type LingBotFileRef = Awaited<ReturnType<LingbotWorld2Model["uploadFile"]>>;

export type LingBotSceneContract = {
  id: string;
  seed: number;
  invariantPrompt: string;
  branchPrompt: string;
  settledPrompt?: string;
  requiredVisualFacts: string[];
  forbiddenVisualFacts: string[];
  cameraPose: number[];
  attentionWindow: "small" | "large" | "auto";
  maximumFirstFrameMs: number;
};

export type LingBotCheckpoint = {
  id: string;
  frameDataUrl: string;
  uploadedFileRef: LingBotFileRef;
  seed: number;
  worldState: FireTrainingState;
  createdAt: number;
};

export type LingBotRenderJob = {
  jobId: number;
  kind: "initial" | "branch" | "alternative";
  checkpoint: LingBotCheckpoint | null;
  scene: LingBotSceneContract;
};

export type LingBotSessionPort = {
  connect(): Promise<void>;
  uploadReference(source: Blob): Promise<LingBotFileRef>;
  render(job: LingBotRenderJob, reference: LingBotFileRef): Promise<LingBotRenderReceipt>;
  applyDelta(input: {
    jobId: number;
    prompt: string;
    cameraPose: number[];
    attentionWindow: "small" | "large" | "auto";
  }): Promise<LingBotRenderReceipt>;
  pauseAtChunkBoundary(): Promise<void>;
  waitForNextChunk(): Promise<number>;
  setNavigation(input: LingBotNavigationInput): Promise<void>;
  stopNavigation(): Promise<void>;
  getStream(): MediaStream | null;
  disconnect(): Promise<void>;
};
