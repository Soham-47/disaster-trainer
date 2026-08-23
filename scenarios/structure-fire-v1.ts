import { composeScenario } from "../lib/scenario/engine";
import type { ScenarioPack } from "../lib/scenario/types";

export const redCrossFireSource = {
  title: "Home Fire Safety",
  organization: "American Red Cross",
  url: "https://www.redcross.org/content/dam/redcross/atg/PDF_s/Preparedness___Disaster_Recovery/Disaster_Preparedness/Home_Fire/FireFAQs.pdf",
  reviewedAt: "2026-08-23",
};

export const structureFirePack: ScenarioPack = {
  id: "structure-fire-v1",
  version: "1.0.0",
  disasterType: "structure_fire",
  status: "approved",
  supportedParameters: {
    disasterType: ["structure_fire"],
    environment: ["apartment", "hotel", "office"],
    timeOfDay: ["day", "night"],
    occupancy: ["alone", "family"],
    mobilityConstraint: ["none", "child", "elderly_person"],
    infrastructureState: ["normal", "power_outage", "blocked_exit"],
    severity: ["early_warning", "active_danger"],
  },
  forbiddenCombinations: [
    { infrastructureState: "blocked_exit", severity: "early_warning" },
  ],
  decisions: [
    {
      id: "warm-door-decision",
      prompt: "The exit door feels warm. What do you do?",
      requiredCueIds: ["warm-door"],
      choices: [
        {
          id: "open-door",
          label: "Open the door and try the hallway",
          safetyClass: "unsafe",
          consequenceStateId: "open-door-consequence",
        },
        {
          id: "keep-door-closed",
          label: "Keep it closed and call or signal for help",
          safetyClass: "safe",
          consequenceStateId: "keep-door-closed-consequence",
        },
      ],
      recommendedChoiceIds: ["keep-door-closed"],
    },
  ],
  sourceReferences: [redCrossFireSource],
  referenceImage: "/references/bedroom-fire.jpg",
  reactorSeed: 42069,
  basePrompt: "A navigable structure-fire scene with a closed exit door, smoke under the gap, an alarm, and no invented safety instructions.",
  orientFallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
  cues: [
    {
      id: "warm-door",
      learnerCopy: "Smoke is drifting under the closed door, and the door feels warm.",
      requiredVisualFacts: ["closed exit door", "smoke under door", "alarm", "warm door cue"],
    },
  ],
  consequences: {
    "open-door-consequence": {
      stateId: "open-door-consequence",
      selectedChoiceId: "open-door",
      prompt: "The warm door opens into a hallway filled with heavy smoke and intense heat.",
      requiredFacts: ["door opens", "heavy hallway smoke", "intense heat"],
      forbiddenFacts: ["clear safe hallway", "learner receives emergency advice from the model"],
      durationSeconds: 10,
      fallbackAsset: "/fallbacks/fire-hallway-unsafe.mp4",
    },
    "keep-door-closed-consequence": {
      stateId: "keep-door-closed-consequence",
      selectedChoiceId: "keep-door-closed",
      prompt: "The closed door remains a barrier while the learner seals the gap and signals from the window.",
      requiredFacts: ["door remains closed", "signal at window", "smoke held back"],
      forbiddenFacts: ["learner enters hallway", "learner receives emergency advice from the model"],
      durationSeconds: 10,
      fallbackAsset: "/fallbacks/fire-shelter-safe.mp4",
    },
  },
  debrief: {
    warningCue: "A warm closed door with smoke underneath signals danger on the other side.",
    recommendedAction: "Use another exit if it is safe. If exits are blocked, keep the door closed, seal gaps, and call or signal for help.",
    principle: "A closed door can slow heat and smoke; opening a warm door can expose you to a dangerous hallway.",
    source: redCrossFireSource,
  },
  transferScenarioId: "hotel-fire-transfer-v1",
};

export const structureFireScenario = composeScenario(structureFirePack, {
  disasterType: "structure_fire",
  environment: "apartment",
  timeOfDay: "night",
  occupancy: "alone",
  mobilityConstraint: "none",
  infrastructureState: "normal",
  severity: "active_danger",
});
