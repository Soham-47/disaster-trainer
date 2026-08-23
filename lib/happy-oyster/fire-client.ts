import {
  HappyOysterModel,
  type HappyOysterPhase,
  type TravelStateMessage,
} from "@reactor-models/happy-oyster";
import type { AdventureDirection, AdventureLook } from "./controls";
import { FIRE_ACTIONS, type FireAction } from "../fire-training/actions";

export const REVIEWED_FIRE_ACTIONS = FIRE_ACTIONS;
export type ReviewedFireAction = FireAction;
export type FireWorldStatus =
  | "idle"
  | "connecting"
  | "attaching"
  | "starting"
  | "live"
  | "restarting"
  | "ended"
  | "error";

export type FireInteractionOptions = {
  timeoutMs?: number;
};

export type FireInteractionResult = {
  providerAction: string;
  visualConfirmed: false;
  visualReason: string;
};

const DEFAULT_INTERACTION_TIMEOUT_MS = 4_000;

const PROVIDER_ACTION_ALIASES: Partial<Record<ReviewedFireAction, string[]>> = {
  OpenDoor: ["OpenDoor", "open_close_door", "open_door"],
  CloseDoor: ["CloseDoor", "open_close_door", "close_door"],
  CrouchLow: ["CrouchLow", "crouch", "take_cover"],
  FeelDoor: ["FeelDoor", "feel_door", "inspect_door"],
  UsePhone: ["UsePhone", "use_phone", "call_for_help"],
  SignalWindow: ["SignalWindow", "signal_window", "signal_for_help"],
};

type StartInput = {
  token: string;
  worldId: string;
  videoElement: HTMLVideoElement;
};

export class HappyOysterFireClient {
  private model: HappyOysterModel<"adventure"> | null = null;
  private status: FireWorldStatus = "idle";
  private readonly statusListeners = new Set<(status: FireWorldStatus) => void>();
  private readonly availableActions = new Set<string>();
  private readonly unsubscribe: Array<() => void> = [];
  private liveConfirmed = false;

  getStatus() {
    return this.status;
  }

  getAvailableActions() {
    return [...this.availableActions];
  }

  onStatus(listener: (status: FireWorldStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: FireWorldStatus) {
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private bindModel(model: HappyOysterModel<"adventure">) {
    this.unsubscribe.push(
      model.onPhaseChanged((phase: HappyOysterPhase) => {
        if (phase === "failed") this.setStatus("error");
        if (phase === "ended" && this.status !== "restarting") this.setStatus("ended");
        if (phase === "connected" && this.liveConfirmed && this.status === "live") this.setStatus("ended");
        if (phase === "streaming" && this.liveConfirmed) this.setStatus("live");
      }),
      model.onTravelStatusChanged((status) => {
        if (this.status === "restarting") return;
        if (status === "completed" || status === "ended") this.setStatus("ended");
        if (status === "failed" || status === "error") this.setStatus("error");
      }),
      model.onTravelState((state: TravelStateMessage) => {
        this.availableActions.clear();
        [...state.environment_actions, ...state.character_actions].forEach((action) =>
          this.availableActions.add(action)
        );
      }),
      model.onTravelError(() => this.setStatus("error"))
    );
  }

  async start({ token, worldId, videoElement }: StartInput) {
    await this.disconnect();
    this.setStatus("connecting");
    const model = new HappyOysterModel({ mode: "adventure", videoElement });
    this.model = model;
    this.bindModel(model);

    try {
      await model.connect(token);
      this.setStatus("attaching");
      const world = await model.attachWorld(worldId);
      if (world.mode !== null && world.mode !== 1) {
        throw new Error("The configured world is not a Happy Oyster Adventure world.");
      }
      this.setStatus("starting");
      const result = await model.startTravel();
      if (!result.streaming) throw new Error("Happy Oyster did not publish a live stream.");
      this.liveConfirmed = true;
      this.setStatus("live");
    } catch (error) {
      this.setStatus("error");
      throw error;
    }
  }

  async move(direction: AdventureDirection) {
    if (this.status !== "live" || !this.model) return;
    await this.model.move(direction);
  }

  async look(direction: AdventureLook) {
    if (this.status !== "live" || !this.model) return;
    await this.model.look(direction);
  }

  async releaseMovement() {
    if (this.status === "live" && this.model) await this.model.release({ translation: true });
  }

  async releaseLook() {
    if (this.status === "live" && this.model) await this.model.release({ rotation: true });
  }

  async stop() {
    if (this.model && this.status === "live") await this.model.stop();
  }

  async interact(action: ReviewedFireAction, options: FireInteractionOptions = {}): Promise<FireInteractionResult> {
    if (!REVIEWED_FIRE_ACTIONS.includes(action)) {
      throw new Error(`Interaction "${action}" is not reviewed for this scenario.`);
    }
    if (!this.model || this.status !== "live") throw new Error("The live world is not ready.");
    const aliases = PROVIDER_ACTION_ALIASES[action] ?? [action];
    const providerAction = aliases.find((alias) => this.availableActions.has(alias));
    if (!providerAction) {
      throw new Error(`Interaction "${action}" is not available in the attached world.`);
    }
    const timeoutMs = options.timeoutMs ?? DEFAULT_INTERACTION_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await this.model!.interact(providerAction);
          await new Promise((resolve) => setTimeout(resolve, 280));
          await this.model!.release({ interaction: true });
        })(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Interaction "${action}" timed out after ${timeoutMs}ms.`)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
    return {
      providerAction,
      visualConfirmed: false,
      visualReason: "Happy Oyster accepted the interaction, but it does not expose object-level door state for visual confirmation.",
    };
  }

  async approachAndInteract(action: ReviewedFireAction, approachMs = 900, options: FireInteractionOptions = {}) {
    await this.move("Front");
    if (approachMs > 0) await new Promise((resolve) => setTimeout(resolve, approachMs));
    await this.releaseMovement();
    return this.interact(action, options);
  }

  async restartTravel() {
    if (!this.model) throw new Error("No Happy Oyster world is attached.");
    this.setStatus("restarting");
    await this.model.stop();
    await this.model.endTravelSession();
    this.setStatus("starting");
    this.liveConfirmed = false;
    const result = await this.model.startTravel();
    if (!result.streaming) {
      this.setStatus("error");
      throw new Error("Happy Oyster did not publish a live stream after restart.");
    }
    this.liveConfirmed = true;
    this.setStatus("live");
  }

  async disconnect() {
    this.unsubscribe.splice(0).forEach((unsubscribe) => unsubscribe());
    if (this.model) {
      try {
        await this.model.disconnect();
      } finally {
        this.model = null;
      }
    }
    this.liveConfirmed = false;
    this.availableActions.clear();
  }
}
