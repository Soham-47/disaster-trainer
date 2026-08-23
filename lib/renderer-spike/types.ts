export type { SpikeAction } from "./fire-spike-reducer";

export type FireObjectId =
  | "smoke-alarm"
  | "smoke-under-door"
  | "bedroom-door"
  | "phone"
  | "window"
  | "flashlight"
  | "signal-cloth";

export type FireInteraction =
  | "listen-alarm"
  | "inspect-smoke"
  | "feel-door"
  | "open-door"
  | "keep-door-closed"
  | "use-phone"
  | "signal-window"
  | "crouch-low";

export type RendererCheckpoint = {
  playerPosition: [number, number, number];
  playerYaw: number;
  playerPitch: number;
  crouched: boolean;
  doorOpen: boolean;
  smokeDensity: number;
  hallwayLightIntensity: number;
  discoveredCueIds: string[];
  completedActionIds: string[];
  hazardExposure: number;
};

export type FireSpikeState = {
  playerPosition: [number, number, number];
  playerYaw: number;
  playerPitch: number;
  crouched: boolean;
  doorOpen: boolean;
  doorInspected: boolean;
  smokeDensity: number;
  hallwayLightIntensity: number;
  hazardExposure: number;
  discoveredCueIds: string[];
  completedActionIds: string[];
  currentObjective: string;
  reducedMotion: boolean;
  checkpoint: RendererCheckpoint | null;
  activeAudioCaption: string | null;
  audioPlaying: boolean;
  lastCapturedFrameUrl: string | null;
};

export type InteractiveObjectSpec = {
  id: FireObjectId;
  name: string;
  position: [number, number, number];
  interactionDistance: number;
  interaction: FireInteraction;
  promptText: string;
  description: string;
};
