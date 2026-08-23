import { composeScenario } from "../lib/scenario/engine";
import type { ScenarioPack } from "../lib/scenario/types";

export const cycloneSource = {
  title: "Hurricane Hazard Information Sheet",
  organization: "FEMA / Ready.gov",
  url: "https://www.ready.gov/sites/default/files/2024-03/ready.gov_hurricane_hazard-info-sheet.pdf",
  reviewedAt: "2026-08-23",
};

export const cyclonePack: ScenarioPack = {
  id: "cyclone-v1",
  version: "1.0.0",
  disasterType: "cyclone",
  status: "approved",
  supportedParameters: {
    disasterType: ["cyclone"],
    environment: ["apartment", "hotel", "office", "school"],
    timeOfDay: ["day", "night"],
    occupancy: ["alone", "family", "crowd"],
    mobilityConstraint: ["none", "child", "elderly_person"],
    infrastructureState: ["normal", "power_outage", "blocked_exit"],
    severity: ["early_warning", "active_danger"],
  },
  forbiddenCombinations: [],
  decisions: [{
    id: "cyclone-shelter-decision",
    prompt: "The wind warning is active and the windows are rattling. Where do you go?",
    requiredCueIds: ["cyclone-wind-warning"],
    choices: [
      {
        id: "interior-shelter",
        label: "Move to a small interior room away from windows",
        safetyClass: "safe",
        consequenceStateId: "interior-shelter-consequence",
      },
      {
        id: "watch-by-window",
        label: "Stand by the window or go outside to watch the storm",
        safetyClass: "unsafe",
        consequenceStateId: "watch-by-window-consequence",
      },
    ],
    recommendedChoiceIds: ["interior-shelter"],
  }],
  sourceReferences: [cycloneSource],
  referenceImage: "/references/cyclone-shelter-v2.png",
  reactorSeed: 42104,
  basePrompt: "A navigable first-person cyclone scene inside a sturdy high-rise, with heavy rain, high winds, rattling windows, flickering lights, and a small interior windowless room nearby. Keep camera, layout, hazards, and lighting continuous. Visuals only; do not invent advice, people, rooms, or actions.",
  orientFallbackAsset: "/references/cyclone-shelter-v2.png",
  cues: [{
    id: "cyclone-wind-warning",
    learnerCopy: "High winds are rattling the windows, rain is striking the glass, and the power is flickering.",
    requiredVisualFacts: ["high wind", "rattling windows", "heavy rain", "interior room"],
  }],
  consequences: {
    "interior-shelter-consequence": {
      stateId: "interior-shelter-consequence",
      selectedChoiceId: "interior-shelter",
      prompt: "The learner moves into the small interior room while wind and rain continue outside.",
      requiredFacts: ["small interior room", "learner away from windows", "continued wind and rain"],
      forbiddenFacts: ["learner stands at a window", "learner goes outdoors", "model gives emergency advice"],
      durationSeconds: 10,
      fallbackAsset: "/references/cyclone-shelter-v2.png",
    },
    "watch-by-window-consequence": {
      stateId: "watch-by-window-consequence",
      selectedChoiceId: "watch-by-window",
      prompt: "The learner stays by the rattling window as wind-driven rain and loose objects strike outside.",
      requiredFacts: ["rattling window", "wind-driven rain", "loose objects outside"],
      forbiddenFacts: ["calm weather", "learner is safely sheltered", "model gives emergency advice"],
      durationSeconds: 10,
      fallbackAsset: "/references/cyclone-shelter-v2.png",
    },
  },
  debrief: {
    warningCue: "High winds and rattling windows signal that flying glass and debris are hazards.",
    recommendedAction: "Shelter in a small interior room away from windows and doors.",
    principle: "Putting more walls between you and the outside reduces exposure to wind-driven debris.",
    source: cycloneSource,
  },
  transferScenarioId: "cyclone-hotel-transfer-v1",
};

export const cycloneScenario = composeScenario(cyclonePack, {
  disasterType: "cyclone",
  environment: "apartment",
  timeOfDay: "night",
  occupancy: "family",
  mobilityConstraint: "none",
  infrastructureState: "power_outage",
  severity: "active_danger",
});
