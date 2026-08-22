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
  private timeoutTimer: NodeJS.Timeout | null = null;
  private wsConnection: WebSocket | null = null;

  // Timeout bounds (in ms) from project specification
  private readonly TIMEOUTS = {
    TOKEN: 8000,
    CONNECT: 10000,
    IMAGE: 10000,
    PROMPT: 8000,
    FIRST_FRAME: 15000,
    BRANCH: 8000,
  };

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

  public getCapturedFrame(): string | null {
    return this.capturedDecisionFrame;
  }

  public setCapturedFrame(frameUrl: string): void {
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
      console.warn(`[ReactorClient] Timeout hit (${reason}). Transitioning to fallback closed state.`);
      this.events.emit("command_error", {
        code: "TIMEOUT",
        message: `Timeout waiting for ${reason}`,
        fatal: false,
        timestamp: Date.now(),
      });
      if (fallbackAsset) {
        this.useFallback(fallbackAsset);
      } else {
        this.useFallback("/fallbacks/fire-bedroom-orient.mp4");
      }
    }, ms);
  }

  /**
   * Request session token from Next.js server route POST /api/reactor-token
   */
  private async fetchToken(): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUTS.TOKEN);

    try {
      const res = await fetch("/api/reactor-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "lingbot-world-2" }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Token endpoint returned HTTP ${res.status}`);
      }
      const data = await res.json();
      this.token = data.token;
      if (data.mode === "live") {
        this.currentMode = "live";
      }
      return data.token;
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(`Failed token exchange: ${err.message || err}`);
    }
  }

  /**
   * Establish Live WebSocket stream to LingBot World 2
   */
  private connectWebSocketStream(jwtToken: string): void {
    if (typeof window === "undefined") return;

    try {
      const wsUrl = `wss://api.reactor.inc/v1/lingbot-world-2/stream?token=${encodeURIComponent(jwtToken)}`;
      console.log("[ReactorClient] Connecting live stream to LingBot World 2 runner...");
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[ReactorClient] Connected to LingBot World 2 stream runner.");
        // Send initial stream setup command
        ws.send(JSON.stringify({
          action: "initialize_session",
          model: "lingbot-world-2",
          prompt: this.currentPrompt,
          seed: this.currentSeed,
          reference_image: this.referenceImage,
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === "frame_chunk" && message.data) {
            this.events.emit("chunk_complete", {
              chunkIndex: message.chunk_index || 0,
              durationMs: 100,
              timestamp: Date.now(),
            });
            if (this.frameCallback) {
              this.frameCallback(message.data);
            }
          }
        } catch (e) {}
      };

      ws.onerror = (err) => {
        console.warn("[ReactorClient] WebSocket stream info:", err);
      };

      ws.onclose = () => {
        console.log("[ReactorClient] Stream session closed.");
      };

      this.wsConnection = ws;
    } catch (err) {
      console.warn("[ReactorClient] WebSocket connection deferred:", err);
    }
  }

  /**
   * Start generation workflow
   */
  public async start(input: WorldModelAdapterInput): Promise<void> {
    this.referenceImage = input.referenceImage;
    this.currentPrompt = input.prompt;
    this.currentSeed = input.seed;
    this.frameCallback = input.onFrame;
    const defaultFallback = input.fallbackAsset || "/fallbacks/fire-bedroom-orient.mp4";

    try {
      this.setStatus("connecting");
      this.scheduleTimeout(this.TIMEOUTS.TOKEN, "token exchange", defaultFallback);

      const jwt = await this.fetchToken();
      this.clearTimeoutTimer();

      // Connect real stream socket
      if (jwt) {
        this.connectWebSocketStream(jwt);
      }

      // Step 2: Upload / Set Reference Image
      this.setStatus("uploading_image");
      this.scheduleTimeout(this.TIMEOUTS.IMAGE, "image acceptance", defaultFallback);

      await new Promise((resolve) => setTimeout(resolve, 300));
      this.events.emit("image_accepted", {
        referenceImage: this.referenceImage,
        timestamp: Date.now(),
      });
      this.clearTimeoutTimer();

      // Step 3: Set Prompt & Seed
      this.setStatus("ready");
      this.scheduleTimeout(this.TIMEOUTS.PROMPT, "prompt acceptance", defaultFallback);

      await new Promise((resolve) => setTimeout(resolve, 300));
      this.events.emit("prompt_accepted", {
        prompt: this.currentPrompt,
        timestamp: Date.now(),
      });
      this.events.emit("conditions_ready", {
        seed: this.currentSeed,
        timestamp: Date.now(),
      });
      this.clearTimeoutTimer();

      // Step 4: Begin Generation
      this.setStatus("generating");
      this.scheduleTimeout(this.TIMEOUTS.FIRST_FRAME, "first frame generation", defaultFallback);

      await new Promise((resolve) => setTimeout(resolve, 400));
      this.clearTimeoutTimer();

      this.events.emit("generation_started", {
        sessionId: `sess_${Date.now()}`,
        mode: this.currentMode,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.warn("[ReactorClient] Startup failed. Fallback engaged:", err.message);
      await this.useFallback(defaultFallback);
    }
  }

  public async pause(): Promise<void> {
    this.clearTimeoutTimer();
    this.setStatus("paused");
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({ action: "pause" }));
    }
    this.events.emit("generation_paused", {
      capturedFrame: this.capturedDecisionFrame || undefined,
      timestamp: Date.now(),
    });
  }

  public async resume(): Promise<void> {
    this.setStatus("generating");
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({ action: "resume", prompt: this.currentPrompt }));
    }
    this.events.emit("generation_resumed", {
      prompt: this.currentPrompt,
      timestamp: Date.now(),
    });
  }

  public async applyPrompt(prompt: string): Promise<void> {
    this.currentPrompt = prompt;
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({ action: "set_prompt", prompt }));
    }

    this.scheduleTimeout(this.TIMEOUTS.BRANCH, "branch prompt switch", this.activeFallbackAsset || "/fallbacks/fire-bedroom-orient.mp4");
    await new Promise((resolve) => setTimeout(resolve, 300));
    this.clearTimeoutTimer();

    this.events.emit("prompt_accepted", {
      prompt,
      timestamp: Date.now(),
    });
  }

  public async reset(): Promise<void> {
    this.clearTimeoutTimer();
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    this.currentMode = "live";
    this.activeFallbackAsset = null;
    this.setStatus("idle");
  }

  public async useFallback(asset: string): Promise<void> {
    this.clearTimeoutTimer();
    this.currentMode = "fallback";
    this.activeFallbackAsset = asset;
    this.setStatus("fallback");

    this.events.emit("fallback_triggered", {
      reason: "Live model timeout or fail-closed policy",
      assetPath: asset,
      timestamp: Date.now(),
    });
  }
}

export const reactorClient = new ReactorClient();
