import type { GeneratedScenario } from "@/lib/scenario/types";

/** UI fixture for Phase 1; Phase 2 replaces this with the approved scenario pack. */
export const demoScenario: GeneratedScenario = {
  id: "structure-fire-demo",
  packId: "structure-fire-v1",
  packVersion: "1.0.0-demo",
  parameters: {
    disasterType: "structure_fire",
    environment: "apartment",
    timeOfDay: "night",
    occupancy: "alone",
    mobilityConstraint: "none",
    infrastructureState: "normal",
    severity: "active_danger",
  },
  referenceImage: "/references/bedroom-fire.jpg",
  reactorSeed: 42069,
  basePrompt: "A bedroom with smoke under a closed exit door and an emergency alarm sounding.",
  cues: [
    {
      id: "warm-door",
      learnerCopy: "Smoke is drifting under the closed door, and the door feels warm.",
      requiredVisualFacts: ["closed bedroom door", "smoke under door", "alarm"]
    },
  ],
  decision: {
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
  consequences: {
    "open-door-consequence": {
      stateId: "open-door-consequence",
      selectedChoiceId: "open-door",
      prompt: "The warm door opens into a hallway filled with heavy smoke and intense heat.",
      requiredFacts: ["smoke fills hallway", "door opens"],
      forbiddenFacts: ["clear safe hallway"],
      durationSeconds: 10,
      fallbackAsset: "/fallbacks/fire-hallway-unsafe.mp4",
    },
    "keep-door-closed-consequence": {
      stateId: "keep-door-closed-consequence",
      selectedChoiceId: "keep-door-closed",
      prompt: "The closed door remains a barrier while you seal the gap and signal from the window.",
      requiredFacts: ["door remains closed", "signal at window"],
      forbiddenFacts: ["learner enters hallway"],
      durationSeconds: 10,
      fallbackAsset: "/fallbacks/fire-shelter-safe.mp4",
    },
  },
  debrief: {
    warningCue: "A warm closed door with smoke underneath signals danger on the other side.",
    recommendedAction: "Use another exit if it is safe. If exits are blocked, keep the door closed, seal gaps, and call or signal for help.",
    principle: "A closed door can slow heat and smoke; opening a warm door can expose you to a dangerous hallway.",
    source: {
      title: "Home Fire Safety",
      organization: "American Red Cross",
      url: "https://www.redcross.org/content/dam/redcross/atg/PDF_s/Preparedness___Disaster_Recovery/Disaster_Preparedness/Home_Fire/FireFAQs.pdf",
      reviewedAt: "2026-08-23",
    },
  },
  transferScenarioId: "hotel-fire-transfer-demo",
  validationStatus: "illustrative",
};

