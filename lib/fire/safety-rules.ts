import type { FireBranch, FireCueId } from "./types";

/**
 * Human-reviewed safety rules for the apartment-fire episode.
 * Grounded in American Red Cross home-fire guidance:
 * https://www.redcross.org/content/dam/redcross/atg/PDF_s/Preparedness___Disaster_Recovery/Disaster_Preparedness/Home_Fire/FireFAQs.pdf
 *
 * This module is the single source of truth for which actions exist,
 * what they require, and how the controller may respond to them.
 */

export const FIRE_SOURCE = {
  title: "Home Fire FAQs and Safety",
  organization: "American Red Cross",
  url: "https://www.redcross.org/content/dam/redcross/atg/PDF_s/Preparedness___Disaster_Recovery/Disaster_Preparedness/Home_Fire/FireFAQs.pdf",
} as const;

export const FIRE_CUES: Record<FireCueId, { learnerCopy: string; awarenessWeight: number }> = {
  alarm: { learnerCopy: "A smoke alarm is sounding.", awarenessWeight: 1 },
  "smoke-under-door": {
    learnerCopy: "Smoke is seeping in under the closed door.",
    awarenessWeight: 2,
  },
  "warm-door": {
    learnerCopy: "The door handle and door face feel warm to the back of your hand.",
    awarenessWeight: 3,
  },
  phone: { learnerCopy: "Your mobile phone is within reach.", awarenessWeight: 1 },
  window: { learnerCopy: "There is a closed window overlooking the street.", awarenessWeight: 1 },
  flashlight: { learnerCopy: "A flashlight is in the nightstand drawer.", awarenessWeight: 1 },
  cloth: { learnerCopy: "A cotton cloth hangs near the sink.", awarenessWeight: 2 },
};

/** Exposure accrual per elapsed second. All values reviewed constants — no runtime randomness. */
export const EXPOSURE_RATES = {
  /** Smoke already inside the room before any branch is taken. */
  ambientPerSecond: 0.2,
  /** Immediate influx when a warm door is opened onto a smoke-filled hallway. */
  openDoorImmediateInflux: 40,
  /** Sustained accrual while the door stands open. */
  openDoorPerSecond: 1.5,
  /** Accrual with the door kept closed against smoke. */
  closedDoorPerSecond: 0.3,
} as const;

export const EXPOSURE_MULTIPLIERS = {
  gapSealed: 0.5,
  faceCovered: 0.5,
  stayingLow: 0.5,
} as const;

export const PENALTIES = {
  /** Opening the window feeds the fire fresh oxygen. */
  windowOpened: 15,
} as const;

export const CREDITS = {
  emergencyCalled: 10,
  signalSent: 5,
  fullCueAwareness: 8,
} as const;

export const THRESHOLDS = {
  exposureCollapse: 60,
  exposureCap: 100,
  smokeCap: 100,
  maxTickSeconds: 30,
} as const;

export type ReviewedFireActionRule = {
  id: string;
  label: string;
  safetyClass: "safe" | "unsafe" | "conditional";
  requiresCueIds: FireCueId[];
  requiresFlags?: string[];
};

/**
 * The reviewed action catalog. Anything outside this list must be rejected
 * by the controller before reaching either renderer.
 */
export const REVIEWED_FIRE_ACTIONS: Record<string, ReviewedFireActionRule> = {
  "seal-gap-with-cloth": {
    id: "seal-gap-with-cloth",
    label: "Seal the door gap with cloth",
    safetyClass: "safe",
    requiresCueIds: ["cloth"],
  },
  "wet-cloth-over-face": {
    id: "wet-cloth-over-face",
    label: "Hold a wet cloth over your face",
    safetyClass: "safe",
    requiresCueIds: ["cloth"],
    requiresFlags: ["gapSealed"],
  },
  "stay-low-toggle": {
    id: "stay-low-toggle",
    label: "Stay low beneath the smoke",
    safetyClass: "safe",
    requiresCueIds: [],
  },
  "open-window": {
    id: "open-window",
    label: "Open the window",
    safetyClass: "unsafe",
    requiresCueIds: ["window"],
  },
  "call-emergency": {
    id: "call-emergency",
    label: "Call emergency services (112 / 911)",
    safetyClass: "safe",
    requiresCueIds: ["phone"],
  },
  "signal-from-window": {
    id: "signal-from-window",
    label: "Signal for help from the window",
    safetyClass: "safe",
    requiresCueIds: ["window"],
    requiresFlags: ["windowOpened"],
  },
};

export const RECOMMENDED_BRANCH: FireBranch = "keep-door-closed";

export const DEBRIEF_LINES = {
  survived:
    "You kept the door closed on a hot, smoke-filled hallway, sealed the gap, stayed low, and called for help. Firefighters reached you because you made yourself findable.",
  unsafeFuture:
    "Opening a door that feels warm can put you between yourself and superheated gases. In a real fire this can cause flashover or a smoke explosion.",
  collapsed:
    "Smoke, not flame, causes most fire deaths. Without protection your exposure crossed the danger threshold within the drill clock.",
  principle:
    "Feel doors with the back of your hand before opening them. If a door is warm, keep it closed, seal gaps, signal from a window, and let responders reach you.",
  warningCue:
    "A warm door or smoke under it means fire is on the other side of that wall.",
} as const;
