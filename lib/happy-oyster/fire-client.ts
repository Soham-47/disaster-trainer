import {
  HappyOysterModel,
  type HappyOysterPhase,
  type TravelStateMessage,
} from "@reactor-models/happy-oyster";
import type { AdventureDirection, AdventureLook } from "./controls";

export const REVIEWED_FIRE_ACTIONS = [
  "ListenAlarm",
  "InspectSmoke",
  "FeelDoor",
  "OpenDoor",
  "KeepDoorClosed",
  "UsePhone",
  "SignalWindow",
  "CrouchLow",
] as const;

export type ReviewedFireAction = (typeof REVIEWED_FIRE_ACTIONS)[number];
export type FireWorldStatus =
  | "idle"
  | "connecting"
  | "attaching"
  | "starting"
  | "live"
  | "restarting"
  | "ended"
  | "error";

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
        if (phase === "streaming" && this.liveConfirmed) this.setStatus("live");
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

  async stop() {
    if (this.model && this.status === "live") await this.model.stop();
  }

  async interact(action: ReviewedFireAction) {
    if (!REVIEWED_FIRE_ACTIONS.includes(action)) {
      throw new Error(`Interaction "${action}" is not reviewed for this scenario.`);
    }
    if (!this.model || this.status !== "live") throw new Error("The live world is not ready.");
    if (this.availableActions.size > 0 && !this.availableActions.has(action)) {
      throw new Error(`Interaction "${action}" is not available in the attached world.`);
    }
    await this.model.interact(action);
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
