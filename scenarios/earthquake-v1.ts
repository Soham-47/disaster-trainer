import { composeScenario } from "../lib/scenario/engine";
import type { ScenarioPack } from "../lib/scenario/types";

export const earthquakeSource = {
  title: "Earthquake Hazard Information Sheet",
  organization: "FEMA / Ready.gov",
  url: "https://www.ready.gov/sites/default/files/2024-03/ready.gov_earthquake_hazard-info-sheet.pdf",
  reviewedAt: "2026-08-23",
};

export const earthquakePack: ScenarioPack = {
  id: "earthquake-v1",
  version: "1.0.0",
  disasterType: "earthquake",
  status: "approved",
  supportedParameters: {
    disasterType: ["earthquake"],
    environment: ["apartment", "office", "school", "hotel"],
    timeOfDay: ["day", "night"],
    occupancy: ["alone", "family", "crowd"],
    mobilityConstraint: ["none", "child", "elderly_person"],
    infrastructureState: ["normal", "power_outage"],
    severity: ["early_warning", "active_danger"],
  },
  forbiddenCombinations: [],
  decisions: [{
    id: "earthquake-shaking-decision",
    prompt: "The room is shaking and a bookcase is moving. What do you do?",
    requiredCueIds: ["earthquake-shaking"],
    choices: [
      {
        id: "drop-cover-hold",
        label: "Drop beside the sturdy table, cover your head, and hold on",
        safetyClass: "safe",
        consequenceStateId: "drop-cover-hold-consequence",
      },
      {
        id: "run-during-shaking",
        label: "Run toward the stairwell while the building is shaking",
        safetyClass: "unsafe",
        consequenceStateId: "run-during-shaking-consequence",
      },
    ],
    recommendedChoiceIds: ["drop-cover-hold"],
  }],
  sourceReferences: [earthquakeSource],
  referenceImage: "/references/earthquake-room-v2.png",
  reactorSeed: 42101,
  basePrompt: "A navigable first-person earthquake scene inside a high-rise room during active shaking, with a sturdy table, moving bookcase, rattling windows, falling dust, and flickering lights. Keep camera, layout, hazards, and lighting continuous. Visuals only; do not invent advice, people, rooms, or actions.",
  orientFallbackAsset: "/references/earthquake-room-v2.png",
  cues: [{
    id: "earthquake-shaking",
    learnerCopy: "The floor is shaking, objects are moving, and dust is falling near a sturdy table.",
    requiredVisualFacts: ["active shaking", "moving object", "sturdy table", "falling dust"],
  }],
  consequences: {
    "drop-cover-hold-consequence": {
      stateId: "drop-cover-hold-consequence",
      selectedChoiceId: "drop-cover-hold",
      prompt: "The learner stays low beside the sturdy table, covers their head and neck, and holds on while the shaking continues.",
      requiredFacts: ["learner stays low", "sturdy table", "covered head and neck", "continued shaking"],
      forbiddenFacts: ["learner runs outside", "model gives emergency advice"],
      durationSeconds: 10,
      fallbackAsset: "/references/earthquake-room-v2.png",
    },
    "run-during-shaking-consequence": {
      stateId: "run-during-shaking-consequence",
      selectedChoiceId: "run-during-shaking",
      prompt: "The learner crosses the shaking room as loose objects fall near the path to the stairwell.",
      requiredFacts: ["shaking room", "falling objects", "stairwell path"],
      forbiddenFacts: ["clear safe route", "model gives emergency advice"],
      durationSeconds: 10,
      fallbackAsset: "/references/earthquake-room-v2.png",
    },
  },
  debrief: {
    warningCue: "Shaking objects and falling dust mean the earthquake is active now.",
    recommendedAction: "Drop, cover your head and neck, and hold on to sturdy cover until the shaking stops.",
    principle: "During indoor shaking, moving only as far as needed to reach cover reduces exposure to falling objects.",
    source: earthquakeSource,
  },
  transferScenarioId: "earthquake-office-transfer-v1",
};

export const earthquakeScenario = composeScenario(earthquakePack, {
  disasterType: "earthquake",
  environment: "apartment",
  timeOfDay: "night",
  occupancy: "alone",
  mobilityConstraint: "none",
  infrastructureState: "power_outage",
  severity: "active_danger",
});
