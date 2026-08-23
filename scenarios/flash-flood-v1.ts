import { composeScenario } from "../lib/scenario/engine";
import type { ScenarioPack } from "../lib/scenario/types";

export const flashFloodSource = {
  title: "Floods",
  organization: "FEMA / Ready.gov",
  url: "https://www.ready.gov/floods",
  reviewedAt: "2026-08-23",
};

export const flashFloodPack: ScenarioPack = {
  id: "flash-flood-v1",
  version: "1.0.0",
  disasterType: "flash_flood",
  status: "approved",
  supportedParameters: {
    disasterType: ["flash_flood"],
    environment: ["apartment", "office", "street", "shopping_mall"],
    timeOfDay: ["day", "night"],
    occupancy: ["alone", "family", "crowd"],
    mobilityConstraint: ["none", "child", "elderly_person"],
    infrastructureState: ["normal", "power_outage", "blocked_exit"],
    severity: ["early_warning", "active_danger"],
  },
  forbiddenCombinations: [],
  decisions: [{
    id: "floodwater-decision",
    prompt: "Fast water is covering the lower exit. What do you do?",
    requiredCueIds: ["rising-floodwater"],
    choices: [
      {
        id: "move-to-higher-ground",
        label: "Move to a higher floor and stay away from the water",
        safetyClass: "safe",
        consequenceStateId: "move-to-higher-ground-consequence",
      },
      {
        id: "walk-through-floodwater",
        label: "Walk through the flooded exit to reach the street",
        safetyClass: "unsafe",
        consequenceStateId: "walk-through-floodwater-consequence",
      },
    ],
    recommendedChoiceIds: ["move-to-higher-ground"],
  }],
  sourceReferences: [flashFloodSource],
  referenceImage: "/references/flash-flood-room.png",
  reactorSeed: 42102,
  basePrompt: "A navigable first-person flash-flood scene in a ground-floor building during a sudden downpour, with water rising outside the lower exit, floating debris beyond the glass, and a visible stairway to a higher floor. Keep camera, layout, hazards, and lighting continuous. Visuals only; do not invent advice, people, rooms, or actions.",
  orientFallbackAsset: "/fallbacks/flash-flood-room.svg",
  cues: [{
    id: "rising-floodwater",
    learnerCopy: "Water is rising over the lower exit, and floating debris is moving quickly outside.",
    requiredVisualFacts: ["rising water", "lower exit", "moving debris", "higher floor route"],
  }],
  consequences: {
    "move-to-higher-ground-consequence": {
      stateId: "move-to-higher-ground-consequence",
      selectedChoiceId: "move-to-higher-ground",
      prompt: "The learner reaches a higher floor while fast water remains below and away from the route.",
      requiredFacts: ["higher floor", "fast water below", "learner away from water"],
      forbiddenFacts: ["learner wades through water", "learner enters a closed attic", "model gives emergency advice"],
      durationSeconds: 10,
      fallbackAsset: "/fallbacks/flash-flood-room.svg",
    },
    "walk-through-floodwater-consequence": {
      stateId: "walk-through-floodwater-consequence",
      selectedChoiceId: "walk-through-floodwater",
      prompt: "The learner approaches fast-moving floodwater at the lower exit as debris and hidden hazards obscure the path.",
      requiredFacts: ["fast-moving water", "debris", "obscured path", "lower exit"],
      forbiddenFacts: ["clear dry crossing", "model gives emergency advice"],
      durationSeconds: 10,
      fallbackAsset: "/fallbacks/flash-flood-room.svg",
    },
  },
  debrief: {
    warningCue: "Fast-rising water and moving debris make the lower exit dangerous.",
    recommendedAction: "Move to higher ground or a higher floor and stay out of floodwater.",
    principle: "Floodwater can hide debris, contamination, and currents; gaining height avoids the rising flow.",
    source: flashFloodSource,
  },
  transferScenarioId: "flash-flood-office-transfer-v1",
};

export const flashFloodScenario = composeScenario(flashFloodPack, {
  disasterType: "flash_flood",
  environment: "apartment",
  timeOfDay: "day",
  occupancy: "family",
  mobilityConstraint: "none",
  infrastructureState: "power_outage",
  severity: "active_danger",
});
