import { composeScenario } from "../lib/scenario/engine";
import type { ScenarioPack } from "../lib/scenario/types";

export const wildfireSource = {
  title: "Wildfire Information Sheet",
  organization: "FEMA / Ready.gov",
  url: "https://www.ready.gov/sites/default/files/2024-08/ready-gov_wildfire_info-sheet.pdf",
  reviewedAt: "2026-08-23",
};

export const wildfirePack: ScenarioPack = {
  id: "wildfire-v1",
  version: "1.0.0",
  disasterType: "wildfire",
  status: "approved",
  supportedParameters: {
    disasterType: ["wildfire"],
    environment: ["apartment", "office", "street", "vehicle"],
    timeOfDay: ["day", "night"],
    occupancy: ["alone", "family"],
    mobilityConstraint: ["none", "child", "elderly_person"],
    infrastructureState: ["normal", "power_outage", "network_failure"],
    severity: ["early_warning", "active_danger"],
  },
  forbiddenCombinations: [],
  decisions: [{
    id: "wildfire-evacuation-decision",
    prompt: "Smoke is thickening and an evacuation alert is active. What do you do?",
    requiredCueIds: ["wildfire-alert"],
    choices: [
      {
        id: "leave-on-route",
        label: "Leave immediately on the marked evacuation route",
        safetyClass: "safe",
        consequenceStateId: "leave-on-route-consequence",
      },
      {
        id: "stay-to-pack",
        label: "Stay to gather more belongings and watch the fire",
        safetyClass: "unsafe",
        consequenceStateId: "stay-to-pack-consequence",
      },
    ],
    recommendedChoiceIds: ["leave-on-route"],
  }],
  sourceReferences: [wildfireSource],
  referenceImage: "/references/wildfire-home-v2.png",
  reactorSeed: 42103,
  basePrompt: "A navigable first-person wildfire evacuation scene at the edge of a hillside neighborhood, with thick smoke and ember glow beyond the windows, plain packed evacuation supplies by the door, and a clear outbound driveway away from the fire. Keep camera, layout, hazards, and lighting continuous. Visuals only; do not invent advice, people, rooms, or actions.",
  orientFallbackAsset: "/references/wildfire-home-v2.png",
  cues: [{
    id: "wildfire-alert",
    learnerCopy: "Smoke is thickening, embers are visible, and an official evacuation alert is on screen.",
    requiredVisualFacts: ["thick smoke", "embers", "packed evacuation supplies", "clear outbound driveway"],
  }],
  consequences: {
    "leave-on-route-consequence": {
      stateId: "leave-on-route-consequence",
      selectedChoiceId: "leave-on-route",
      prompt: "The viewpoint leaves along the clear outbound driveway as smoke gathers behind the neighborhood.",
      requiredFacts: ["clear outbound driveway", "viewpoint leaves", "smoke behind neighborhood"],
      forbiddenFacts: ["learner returns to the fire", "learner fights the fire", "model gives emergency advice"],
      durationSeconds: 10,
      fallbackAsset: "/references/wildfire-home-v2.png",
    },
    "stay-to-pack-consequence": {
      stateId: "stay-to-pack-consequence",
      selectedChoiceId: "stay-to-pack",
      prompt: "Smoke thickens around the property while the learner remains inside gathering belongings.",
      requiredFacts: ["thickening smoke", "learner remains inside", "delayed departure"],
      forbiddenFacts: ["fire is safely contained", "model gives emergency advice"],
      durationSeconds: 10,
      fallbackAsset: "/references/wildfire-home-v2.png",
    },
  },
  debrief: {
    warningCue: "An official evacuation alert with thick smoke and embers means conditions can worsen quickly.",
    recommendedAction: "Leave immediately when authorities advise or order evacuation and follow the marked route.",
    principle: "Early departure reduces the chance of being trapped by fire, smoke, or road congestion.",
    source: wildfireSource,
  },
  transferScenarioId: "wildfire-vehicle-transfer-v1",
};

export const wildfireScenario = composeScenario(wildfirePack, {
  disasterType: "wildfire",
  environment: "apartment",
  timeOfDay: "day",
  occupancy: "family",
  mobilityConstraint: "none",
  infrastructureState: "normal",
  severity: "active_danger",
});
