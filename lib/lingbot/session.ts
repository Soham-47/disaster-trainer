import { LingbotWorld2Model } from "@reactor-models/lingbot-world-2";
import type { LingBotRenderReceipt } from "../fire-training/runtime";
import { LingBotCommandError, LingBotTimeoutError, LingBotTransportError } from "./errors";
import type {
  LingBotFileRef,
  LingBotNavigationInput,
  LingBotRenderJob,
  LingBotSessionPort,
} from "./types";

const TIMEOUTS = {
  token: 15_000,
  connect: 60_000,
  image: 20_000,
  prompt: 15_000,
  reset: 20_000,
  chunk: 20_000,
  pause: 20_000,
} as const;

type Waiter<T> = {
  promise: Promise<T>;
  cancel(error: Error): void;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error);
}

export class LingBotSession implements LingBotSessionPort {
  private model: LingbotWorld2Model | null = null;
  private stream: MediaStream | null = null;
  private subscriptions = new Set<() => void>();
  private pendingRejectors = new Set<(error: Error) => void>();
  private lastError: Error | null = null;
  private generationActive = false;
  private operationTail: Promise<void> = Promise.resolve();
  private connecting: Promise<void> | null = null;

  connect(): Promise<void> {
    if (this.model?.getStatus() === "ready") return Promise.resolve();
    if (this.connecting) return this.connecting;
    const pending = this.connectOnce().finally(() => {
      if (this.connecting === pending) this.connecting = null;
    });
    this.connecting = pending;
    return pending;
  }

  private async connectOnce(): Promise<void> {
    if (this.model?.getStatus() === "ready") return;
    if (this.model) await this.disconnect();

    const token = await this.fetchToken();
    const model = new LingbotWorld2Model();
    this.model = model;
    this.track(model.onCommandError((message) => {
      this.failPending(new LingBotCommandError(message.command, message.reason));
    }));
    // The SDK can deliver the recvonly main-video track while the WebRTC
    // connection is becoming ready. Capture it before connect() resolves so
    // render() cannot miss the one-shot trackReceived event.
    const videoSubscription = this.track(model.onMainVideo((_track, stream) => {
      if (!isMediaStreamLike(stream)) {
        this.failPending(new LingBotTransportError("LingBot main video event did not contain a MediaStream"));
        return;
      }
      this.stream = stream;
    }));
    const onTransportError = (error: unknown) => {
      this.failPending(new LingBotTransportError(`LingBot transport failed: ${errorMessage(error)}`, error));
    };
    model.on("error", onTransportError);
    this.track(() => model.off("error", onTransportError));

    const ready = this.createWaiter<void>((resolve, reject) => {
      const onStatusChanged = (status: string) => {
        if (status === "ready") resolve();
        else if (status === "disconnected") reject(new LingBotTransportError("LingBot disconnected before becoming ready"));
      };
      model.on("statusChanged", onStatusChanged);
      const unsubscribe = this.track(() => model.off("statusChanged", onStatusChanged));
      if (model.getStatus() === "ready") resolve();
      return unsubscribe;
    }, TIMEOUTS.connect, "LingBot SDK ready status");

    try {
      await this.commandAndWait(ready, () => model.connect(token));
    } catch (error) {
      await this.disconnect().catch(() => undefined);
      throw error;
    } finally {
      videoSubscription();
    }
  }

  async uploadReference(source: Blob): Promise<LingBotFileRef> {
    const model = this.requireModel();
    try {
      return await model.uploadFile(source, { name: "reference.jpg" });
    } catch (error) {
      throw this.transportError("LingBot reference upload failed", error);
    }
  }

  async render(job: LingBotRenderJob, reference: LingBotFileRef): Promise<LingBotRenderReceipt> {
    return this.withGenerationLock(async () => {
      const startedAt = Date.now();
      const model = this.beginOperation();
      if (this.generationActive || job.kind !== "initial") await this.resetAndWait();
      await this.runCommand(() => model.setSeed({ seed: job.scene.seed }), "set seed");
      await this.runCommand(
        () => model.setAttnWindow({ attn_window: job.scene.attentionWindow }),
        "set attention window",
      );
      if (job.scene.cameraPose.length > 0) {
        await this.runCommand(
          () => model.setCameraPose({ camera_pose: job.scene.cameraPose }),
          "set camera pose",
        );
      }
      await this.setImageAndWait(reference);
      const prompt = [job.scene.invariantPrompt, job.scene.branchPrompt, job.scene.settledPrompt]
        .filter(Boolean)
        .join(" ")
        .trim();
      await this.setPromptAndWait(prompt);
      const video = this.waitForVideo(job.scene.maximumFirstFrameMs);
      const firstChunk = this.waitForChunk(job.scene.maximumFirstFrameMs, prompt);
      const confirmation = Promise.all([video.promise, firstChunk.promise]);
      try {
        this.generationActive = true;
        await this.runCommand(() => model.start(), "start generation");
        const [stream, firstChunkIndex] = await confirmation;
        this.stream = stream;
        return { jobId: job.jobId, firstChunkIndex, startedAt, firstFrameAt: Date.now() };
      } catch (error) {
        const failure = this.asLingBotError(error, "LingBot render failed");
        video.cancel(failure);
        firstChunk.cancel(failure);
        await confirmation.catch(() => undefined);
        throw failure;
      }
    });
  }

  async applyDelta(input: {
    jobId: number;
    prompt: string;
    cameraPose: number[];
    attentionWindow: "small" | "large" | "auto";
  }): Promise<LingBotRenderReceipt> {
    return this.withGenerationLock(async () => {
      const startedAt = Date.now();
      const model = this.beginOperation();
      const nextChunk = this.waitForChunk(TIMEOUTS.chunk, input.prompt);
      try {
        await this.runCommand(
          () => model.setAttnWindow({ attn_window: input.attentionWindow }),
          "set attention window",
        );
        if (input.cameraPose.length > 0) {
          await this.runCommand(() => model.setCameraPose({ camera_pose: input.cameraPose }), "set camera pose");
        }
        await this.setPromptAndWait(input.prompt);
        const firstChunkIndex = await nextChunk.promise;
        return { jobId: input.jobId, firstChunkIndex, startedAt, firstFrameAt: Date.now() };
      } catch (error) {
        const failure = this.asLingBotError(error, "LingBot delta failed");
        nextChunk.cancel(failure);
        await nextChunk.promise.catch(() => undefined);
        throw failure;
      }
    });
  }

  async pauseAtChunkBoundary(): Promise<void> {
    await this.withGenerationLock(async () => {
      const model = this.beginOperation();
      await this.waitForNextChunk();
      const paused = this.createWaiter<void>(
        (resolve) => model.onGenerationPaused(() => resolve()),
        TIMEOUTS.pause,
        "generation pause acknowledgement",
      );
      await this.commandAndWait(paused, () => model.pause());
      this.generationActive = false;
    });
  }

  waitForNextChunk(): Promise<number> {
    return this.waitForChunk(TIMEOUTS.chunk).promise;
  }

  async setNavigation(input: LingBotNavigationInput): Promise<void> {
    const model = this.model;
    if (!model || model.getStatus() !== "ready") return;
    this.lastError = null;
    await Promise.all([
      this.runCommand(
        () => model.setMoveLongitudinal({ move_longitudinal: input.forward ? "forward" : input.backward ? "back" : "idle" }),
        "set longitudinal movement",
      ),
      this.runCommand(
        () => model.setMoveLateral({ move_lateral: input.left ? "strafe_left" : input.right ? "strafe_right" : "idle" }),
        "set lateral movement",
      ),
      this.runCommand(() => model.setLookHorizontal({ look_horizontal: input.lookHorizontal }), "set horizontal look"),
      this.runCommand(() => model.setLookVertical({ look_vertical: input.lookVertical }), "set vertical look"),
    ]);
  }

  async stopNavigation(): Promise<void> {
    await this.setNavigation({
      forward: false,
      backward: false,
      left: false,
      right: false,
      lookHorizontal: "idle",
      lookVertical: "idle",
    });
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  async disconnect(): Promise<void> {
    const model = this.model;
    this.model = null;
    this.stream = null;
    this.generationActive = false;
    this.failPending(new LingBotTransportError("LingBot session disconnected"));
    for (const unsubscribe of [...this.subscriptions]) unsubscribe();
    this.subscriptions.clear();
    this.lastError = null;
    if (!model) return;
    try {
      await model.disconnect();
    } catch (error) {
      throw this.transportError("LingBot disconnect failed", error);
    }
  }

  private beginOperation(): LingbotWorld2Model {
    this.lastError = null;
    return this.requireModel();
  }

  private async withGenerationLock<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.operationTail;
    this.operationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private requireModel(): LingbotWorld2Model {
    if (!this.model) throw new LingBotTransportError("LingBot session is not connected");
    return this.model;
  }

  private async fetchToken(): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.token);
    try {
      const response = await fetch("/api/reactor-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "lingbot-world-2" }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({})) as { token?: unknown; mode?: unknown; message?: unknown };
      if (!response.ok) {
        throw new LingBotTransportError(
          typeof data.message === "string" ? data.message : `Reactor token route returned HTTP ${response.status}`,
        );
      }
      if (data.mode !== "live" || typeof data.token !== "string" || data.token.length === 0) {
        throw new LingBotTransportError("Reactor token route did not return a live LingBot token");
      }
      return data.token;
    } catch (error) {
      if (error instanceof LingBotTransportError) throw error;
      throw this.transportError("LingBot token exchange failed", error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async resetAndWait(): Promise<void> {
    const model = this.requireModel();
    const reset = this.createWaiter<void>(
      (resolve) => model.onGenerationReset(() => resolve()),
      TIMEOUTS.reset,
      "generation reset acknowledgement",
    );
    await this.commandAndWait(reset, () => model.reset());
    this.generationActive = false;
  }

  private async setImageAndWait(reference: LingBotFileRef): Promise<void> {
    const model = this.requireModel();
    const accepted = this.createWaiter<void>(
      (resolve) => model.onImageAccepted(() => resolve()),
      TIMEOUTS.image,
      "image acceptance",
    );
    await this.commandAndWait(accepted, () => model.setImage({ image: reference }));
  }

  private async setPromptAndWait(prompt: string): Promise<void> {
    const model = this.requireModel();
    const accepted = this.createWaiter<void>(
      (resolve) => model.onPromptAccepted(() => resolve()),
      TIMEOUTS.prompt,
      "prompt acceptance",
    );
    await this.commandAndWait(accepted, () => model.setPrompt({ prompt }));
  }

  private async startAndWaitForVideo(timeoutMs: number): Promise<void> {
    const model = this.requireModel();
    const video = this.waitForVideo(timeoutMs);
    await this.commandAndWait(video, () => model.start());
  }

  private waitForVideo(timeoutMs: number): Waiter<MediaStream> {
    const model = this.requireModel();
    if (this.stream) {
      return { promise: Promise.resolve(this.stream), cancel: () => undefined };
    }
    return this.createWaiter<MediaStream>(
      (resolve, reject) => model.onMainVideo((_track, stream) => {
        if (!isMediaStreamLike(stream)) {
          reject(new LingBotTransportError("LingBot main video event did not contain a MediaStream"));
          return;
        }
        resolve(stream);
      }),
      timeoutMs,
      "first LingBot video frame",
    );
  }

  private waitForChunk(timeoutMs: number, expectedPrompt?: string): Waiter<number> {
    const model = this.requireModel();
    return this.createWaiter<number>(
      (resolve) => model.onChunkComplete((message) => {
        if (expectedPrompt && message.active_prompt !== expectedPrompt) return;
        resolve(message.chunk_index);
      }),
      timeoutMs,
      "next LingBot chunk",
    );
  }

  private createWaiter<T>(
    subscribe: (resolve: (value: T) => void, reject: (error: Error) => void) => () => void,
    timeoutMs: number,
    operation: string,
  ): Waiter<T> {
    let cancel: (error: Error) => void = () => undefined;
    const promise = new Promise<T>((resolve, reject) => {
      let settled = false;
      let unsubscribe: () => void = () => undefined;
      const cleanup = () => {
        clearTimeout(timeoutId);
        unsubscribe();
        this.pendingRejectors.delete(rejectPending);
      };
      const resolveOnce = (value: T) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };
      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const rejectPending = (error: Error) => rejectOnce(error);
      const timeoutId = setTimeout(
        () => rejectOnce(new LingBotTimeoutError(operation, timeoutMs)),
        timeoutMs,
      );
      this.pendingRejectors.add(rejectPending);
      unsubscribe = this.track(subscribe(resolveOnce, rejectOnce));
      cancel = rejectOnce;
    });
    return { promise, cancel };
  }

  private track(unsubscribe: () => void): () => void {
    let active = true;
    const tracked = () => {
      if (!active) return;
      active = false;
      this.subscriptions.delete(tracked);
      unsubscribe();
    };
    this.subscriptions.add(tracked);
    return tracked;
  }

  private failPending(error: Error): void {
    this.lastError = error;
    for (const reject of [...this.pendingRejectors]) reject(error);
  }

  private async commandAndWait<T>(waiter: Waiter<T>, command: () => Promise<void>): Promise<T> {
    try {
      await command();
      this.throwLastError();
    } catch (error) {
      const failure = error instanceof LingBotCommandError
        || error instanceof LingBotTimeoutError
        || error instanceof LingBotTransportError
        ? error
        : this.transportError("LingBot command failed", error);
      waiter.cancel(failure);
    }
    return waiter.promise;
  }

  private async runCommand(command: () => Promise<void>, operation: string): Promise<void> {
    try {
      await command();
      this.throwLastError();
    } catch (error) {
      if (error instanceof LingBotCommandError || error instanceof LingBotTransportError) throw error;
      throw this.transportError(`LingBot ${operation} failed`, error);
    }
  }

  private throwLastError(): void {
    if (this.lastError) throw this.lastError;
  }

  private asLingBotError(error: unknown, message: string): Error {
    if (error instanceof LingBotCommandError
      || error instanceof LingBotTimeoutError
      || error instanceof LingBotTransportError) return error;
    return this.transportError(message, error);
  }

  private transportError(message: string, cause: unknown): LingBotTransportError {
    return new LingBotTransportError(`${message}: ${errorMessage(cause)}`, cause);
  }
}

function isMediaStreamLike(value: unknown): value is MediaStream {
  return typeof value === "object"
    && value !== null
    && typeof (value as { getTracks?: unknown }).getTracks === "function";
}
