import { LingbotWorld2Model } from "@reactor-models/lingbot-world-2";
import {
  ReactorEventEmitter,
  ReactorEventType,
  ReactorEventListener,
  WorldModelStatus,
} from "./events";

export type { WorldModelStatus };

export type WorldModelAdapterInput = {
  referenceImage: string;
  prompt: string;
  seed: number;
  fallbackAsset?: string;
  onFrame?: (frame: unknown) => void;
};

/** Remote session setup and first-frame generation can outlive a local UI request. */
export const REACTOR_TIMEOUTS = {
  TOKEN: 15_000,
  CONNECT: 60_000,
  IMAGE: 20_000,
  PROMPT: 15_000,
  FIRST_FRAME: 60_000,
  BRANCH: 20_000,
} as const;

export type WorldModelAdapter = {
  start(input: WorldModelAdapterInput): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  applyPrompt(prompt: string): Promise<void>;
  reset(): Promise<void>;
  useFallback(asset: string): Promise<void>;
  onStatus(listener: (status: WorldModelStatus) => void): () => void;
};

export class ReactorClient implements WorldModelAdapter {
  private status: WorldModelStatus = "idle";
  private events: ReactorEventEmitter = new ReactorEventEmitter();
  private token: string | null = null;
  private currentMode: "live" | "fallback" = "live";
  private activeFallbackAsset: string | null = null;
  private currentPrompt: string = "";
  private currentSeed: number = 42;
  private referenceImage: string = "";
  private capturedDecisionFrame: string | null = null;
  private frameCallback?: (frame: unknown) => void;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackReason: string | null = null;
  private model: LingbotWorld2Model | null = null;
  private imageAccepted = false;
  private promptAccepted = false;

  constructor() {
    this.setStatus("idle");
  }

  public getStatus(): WorldModelStatus {
    return this.status;
  }

  public getMode(): "live" | "fallback" {
    return this.currentMode;
  }

  public getActiveFallbackAsset(): string | null {
    return this.activeFallbackAsset;
  }

  public getFallbackReason(): string | null {
    return this.fallbackReason;
  }

  public getCapturedFrame(): string | null {
    return this.capturedDecisionFrame;
  }

  public setCapturedFrame(frameUrl: string | null): void {
    this.capturedDecisionFrame = frameUrl;
  }

  public onStatus(listener: (status: WorldModelStatus) => void): () => void {
    return this.events.on("status_change", ({ status }) => listener(status));
  }

  public on<K extends ReactorEventType>(event: K, listener: ReactorEventListener<K>): () => void {
    return this.events.on(event, listener);
  }

  private setStatus(newStatus: WorldModelStatus): void {
    const prev = this.status;
    this.status = newStatus;
    this.events.emit("status_change", {
      status: newStatus,
      previousStatus: prev,
      timestamp: Date.now(),
    });
  }

  private clearTimeoutTimer(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  private scheduleTimeout(
    ms: number,
    reason: string,
    fallbackAsset?: string
  ): void {
    this.clearTimeoutTimer();
    this.timeoutTimer = setTimeout(() => {
      const timeoutReason = `Timed out waiting for ${reason}`;
      this.fallbackReason = timeoutReason;
      console.warn(`[ReactorClient] ${timeoutReason}. Transitioning to fallback closed state.`);
      this.events.emit("command_error", {
        code: "TIMEOUT",
        message: timeoutReason,
        fatal: false,
        timestamp: Date.now(),
      });
      void this.useFallback(fallbackAsset || "/fallbacks/fire-bedroom-orient.mp4", timeoutReason);
    }, ms);
  }

  /**
   * Request session token from server route POST /api/reactor-token
   */
  private async fetchToken(): Promise<{ token: string; mode: "live" | "fallback" }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REACTOR_TIMEOUTS.TOKEN);

    try {
      const res = await fetch("/api/reactor-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "lingbot-world-2" }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Token route returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.mode !== "live" || !data.token) {
        return { token: "", mode: "fallback" };
      }
      this.token = data.token;
      this.currentMode = "live";
      return { token: data.token, mode: "live" };
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(`Token exchange failed: ${err.message || err}`);
    }
  }

  /**
   * Start generation workflow using official LingBot World 2 SDK
   */
  public async start(input: WorldModelAdapterInput): Promise<void> {
    // Reset previous connection if any
    await this.cleanupModel();

    this.currentMode = "live";
    this.activeFallbackAsset = null;
    this.imageAccepted = false;
    this.promptAccepted = false;
    this.referenceImage = input.referenceImage;
    this.currentPrompt = input.prompt;
    this.currentSeed = input.seed;
    this.frameCallback = input.onFrame;
    this.fallbackReason = null;
    const defaultFallback = input.fallbackAsset || "/fallbacks/fire-bedroom-orient.mp4";

    try {
      this.setStatus("connecting");
      this.scheduleTimeout(REACTOR_TIMEOUTS.TOKEN, "token exchange", defaultFallback);

      const tokenResult = await this.fetchToken();
      this.clearTimeoutTimer();

      if (tokenResult.mode === "fallback" || !tokenResult.token) {
        console.warn("[ReactorClient] Server token route returned fallback mode. Engaging local fallback.");
        await this.useFallback(defaultFallback, "Token route returned fallback mode");
        return;
      }

      // Initialize LingbotWorld2Model
      this.model = new LingbotWorld2Model();

      // Bind SDK events to application event emitter
      this.model.onImageAccepted(() => {
        this.clearTimeoutTimer();
        this.imageAccepted = true;
        if (this.promptAccepted && (this.status === "uploading_image" || this.status === "ready")) {
          this.setStatus("ready");
        }
        this.events.emit("image_accepted", {
          referenceImage: this.referenceImage,
          timestamp: Date.now(),
        });
      });

      this.model.onPromptAccepted((msg) => {
        if (this.status !== "generating" && this.status !== "paused") {
          this.clearTimeoutTimer();
        }
        this.promptAccepted = true;
        if (this.imageAccepted && (this.status === "uploading_image" || this.status === "ready")) {
          this.setStatus("ready");
        }
        this.events.emit("prompt_accepted", {
          prompt: msg.prompt,
          timestamp: Date.now(),
        });
      });

      this.model.onConditionsReady((msg) => {
        this.events.emit("conditions_ready", {
          seed: this.currentSeed,
          timestamp: Date.now(),
        });
      });

      this.model.onGenerationStarted(() => {
        this.setStatus("generating");
        this.events.emit("generation_started", {
          sessionId: `sess_${Date.now()}`,
          mode: "live",
          timestamp: Date.now(),
        });
      });

      this.model.onChunkComplete((msg) => {
        this.events.emit("chunk_complete", {
          chunkIndex: msg.chunk_index,
          durationMs: 100,
          timestamp: Date.now(),
        });
      });

      this.model.onGenerationPaused(() => {
        this.clearTimeoutTimer();
        this.setStatus("paused");
        this.events.emit("generation_paused", {
          capturedFrame: this.capturedDecisionFrame || undefined,
          timestamp: Date.now(),
        });
      });

      this.model.onGenerationResumed(() => {
        this.clearTimeoutTimer();
        this.setStatus("generating");
        this.events.emit("generation_resumed", {
          prompt: this.currentPrompt,
          timestamp: Date.now(),
        });
      });

      this.model.onCommandError((msg) => {
        console.warn(`[ReactorClient] Command Error from Reactor SDK: ${msg.command} - ${msg.reason}`);
        this.events.emit("command_error", {
          code: msg.command,
          message: msg.reason,
          fatal: true,
          timestamp: Date.now(),
        });
        void this.useFallback(defaultFallback, `Reactor command ${msg.command} failed: ${msg.reason}`);
      });

      this.model.onMainVideo((track, stream) => {
        this.clearTimeoutTimer();
        if (this.status !== "paused") {
          this.setStatus("generating");
        }
        if (this.frameCallback) {
          this.frameCallback({ track, stream });
        }
        this.events.emit("frame_ready", {
          frameUrl: "main_video",
          width: 1280,
          height: 720,
          timestamp: Date.now(),
        });
      });

      this.model.on("error", (err: unknown) => {
        console.warn("[ReactorClient] Transport/SDK Error:", err);
        void this.useFallback(
          defaultFallback,
          `Reactor transport error: ${err instanceof Error ? err.message : String(err)}`
        );
      });

      // Connect SDK
      this.scheduleTimeout(REACTOR_TIMEOUTS.CONNECT, "SDK connection", defaultFallback);
      await this.model.connect(tokenResult.token);
      this.clearTimeoutTimer();

      // Step 2: Upload Reference Image
      this.setStatus("uploading_image");
      this.scheduleTimeout(REACTOR_TIMEOUTS.IMAGE, "image upload & acceptance", defaultFallback);

      let imageBlob: Blob;
      if (this.referenceImage.startsWith("data:")) {
        const res = await fetch(this.referenceImage);
        imageBlob = await res.blob();
      } else {
        const res = await fetch(this.referenceImage);
        if (!res.ok) {
          throw new Error(`Failed to load reference image asset: ${this.referenceImage}`);
        }
        imageBlob = await res.blob();
      }

      const fileRef = await this.model.uploadFile(imageBlob, { name: "reference.jpg" });
      await this.model.setImage({ image: fileRef });

      // Step 3: Set Seed & Prompt. The SDK events above remain the source
      // of truth for acceptance; these calls only enqueue the commands.
      this.scheduleTimeout(REACTOR_TIMEOUTS.PROMPT, "prompt acceptance", defaultFallback);

      await this.model.setSeed({ seed: this.currentSeed });
      await this.model.setPrompt({ prompt: this.currentPrompt });

      // Step 4: Begin Generation
      this.scheduleTimeout(REACTOR_TIMEOUTS.FIRST_FRAME, "first frame generation", defaultFallback);
      await this.model.start();
    } catch (err: any) {
      const startupReason = `Live startup failed: ${err.message || err}`;
      this.fallbackReason = startupReason;
      console.warn("[ReactorClient]", startupReason);
      await this.useFallback(defaultFallback, startupReason);
    }
  }

  public async pause(): Promise<void> {
    this.clearTimeoutTimer();
    if (this.currentMode === "live" && this.model) {
      try {
        await this.model.pause();
      } catch (err) {
        await this.useFallback(
          this.activeFallbackAsset || "/fallbacks/fire-bedroom-orient.mp4",
          `Pause failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else {
      this.setStatus("paused");
      this.events.emit("generation_paused", {
        capturedFrame: this.capturedDecisionFrame || undefined,
        timestamp: Date.now(),
      });
    }
  }

  public async resume(): Promise<void> {
    if (this.currentMode === "live" && this.model) {
      try {
        await this.model.resume();
      } catch (err) {
        await this.useFallback(
          this.activeFallbackAsset || "/fallbacks/fire-bedroom-orient.mp4",
          `Resume failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else {
      this.setStatus("generating");
      this.events.emit("generation_resumed", {
        prompt: this.currentPrompt,
        timestamp: Date.now(),
      });
    }
  }

  public async applyPrompt(prompt: string): Promise<void> {
    this.currentPrompt = prompt;
    if (this.currentMode === "live" && this.model) {
      this.scheduleTimeout(
        REACTOR_TIMEOUTS.BRANCH,
        "branch prompt switch",
        this.activeFallbackAsset || "/fallbacks/fire-bedroom-orient.mp4"
      );
      await this.model.setPrompt({ prompt });
    } else {
      this.events.emit("prompt_accepted", {
        prompt,
        timestamp: Date.now(),
      });
    }
  }

  private async cleanupModel(): Promise<void> {
    if (this.model) {
      try {
        await this.model.reset();
        await this.model.disconnect();
      } catch (e) {}
      this.model = null;
    }
  }

  public async reset(): Promise<void> {
    this.clearTimeoutTimer();
    await this.cleanupModel();
    this.currentMode = "live";
    this.activeFallbackAsset = null;
    this.currentPrompt = "";
    this.currentSeed = 42;
    this.referenceImage = "";
    this.capturedDecisionFrame = null;
    this.token = null;
    this.fallbackReason = null;
    this.imageAccepted = false;
    this.promptAccepted = false;
    this.setStatus("idle");
  }

  public async useFallback(asset: string, reason?: string): Promise<void> {
    this.clearTimeoutTimer();
    await this.cleanupModel();
    this.currentMode = "fallback";
    this.activeFallbackAsset = asset;
    this.fallbackReason = reason || this.fallbackReason || "Live model unavailable";
    this.frameCallback?.(null);
    this.setStatus("fallback");

    this.events.emit("fallback_triggered", {
      reason: this.fallbackReason,
      assetPath: asset,
      timestamp: Date.now(),
    });
  }
}

export const reactorClient = new ReactorClient();
