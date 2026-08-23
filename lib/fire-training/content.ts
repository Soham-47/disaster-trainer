import type { FireTrainingStage } from "./reducer";
import type { FireAction } from "./actions";

export const FIRE_WORLD_PROMPT = `First-person nighttime apartment bedroom during the first minute of a realistic structure fire. Keep one stable, coherent room layout across movement: bed behind the camera, closed bedroom door ahead, thin smoke entering only under its gap, window on the right, bedside table with phone and flashlight on the left, bright cloth near the window. Warm low practical lighting, realistic materials and scale, no people, no readable text, no logos, no subtitles. The hallway remains hidden while the door is closed. Support these context actions: listen to the alarm, inspect smoke, feel the door, open or close the door, keep it closed, use the phone, signal at the window, and crouch low. Opening the door must reveal a smoke-filled hot hallway; closing or keeping it closed must preserve the bedroom barrier; using the phone must keep the learner in the bedroom; signaling must face the same window. Never invent exits, rooms, equipment, people, fire-safety advice, or action outcomes.`;

export const FIRE_REFERENCE_IMAGE = "/references/bedroom-fire-v2.png";
export const FIRE_LINGBOT_REFERENCE_IMAGE = FIRE_REFERENCE_IMAGE;

export const FIRE_ACTION_LABELS: Record<FireAction, string> = {
  ListenAlarm: "Listen to alarm",
  InspectSmoke: "Inspect smoke",
  FeelDoor: "Feel the door",
  OpenDoor: "Open the door",
  CloseDoor: "Close the door again",
  KeepDoorClosed: "Keep door closed",
  UsePhone: "Call emergency services",
  SignalWindow: "Signal at the window",
  CrouchLow: "Get low beneath smoke",
};

export const FIRE_STAGE_COPY: Record<FireTrainingStage, { priority: string; prompt: string; hint: string }> = {
  briefing: {
    priority: "Apartment fire · Night",
    prompt: "Explore a live first-person apartment and respond to the cues you discover.",
    hint: "The simulation begins only after a verified live stream is ready.",
  },
  "observe-alarm": {
    priority: "Orient before moving",
    prompt: "An alarm woke you. Confirm what you can hear.",
    hint: "Treat a continuous smoke alarm as a real warning.",
  },
  "inspect-smoke": {
    priority: "Find the hazard cue",
    prompt: "Look toward the bedroom exit and inspect the gap beneath it.",
    hint: "Smoke at a door gap suggests conditions on the other side.",
  },
  "feel-door": {
    priority: "Assess the exit",
    prompt: "Check the closed door without opening it.",
    hint: "Use the back of your hand to check a closed door for heat.",
  },
  decision: {
    priority: "Choose your next action",
    prompt: "The door feels warm and smoke is entering underneath.",
    hint: "A warm door can separate you from fire and hot smoke.",
  },
  consequence: {
    priority: "Conditions are changing",
    prompt: "Watch the consequence, then take the available response.",
    hint: "Reduce exposure and communicate your exact location.",
  },
  "secure-door": {
    priority: "Restore the barrier",
    prompt: "Getting low reduces exposure, but the open door still admits smoke.",
    hint: "Close the door again before calling from the bedroom.",
  },
  response: {
    priority: "Get help to your location",
    prompt: "Use the resources that remain available.",
    hint: "Give responders your address and signal from a window if trapped.",
  },
  outcome: {
    priority: "Initial future complete",
    prompt: "Now restart the same world and test the opposite choice.",
    hint: "Counterfactual comparison makes the safety principle visible.",
  },
  restarting: {
    priority: "Rewinding the same apartment",
    prompt: "Restoring the original live world and decision context.",
    hint: "Your initial decision remains recorded by the deterministic trainer.",
  },
  "counterfactual-decision": {
    priority: "Try the alternative",
    prompt: "The alarm, smoke, and warm door are the same. Take the opposite action.",
    hint: "Only the decision changes; the safety facts do not.",
  },
  "counterfactual-consequence": {
    priority: "Compare the futures",
    prompt: "Watch how the alternative changes smoke and heat exposure.",
    hint: "Focus on the closed door as a protective barrier.",
  },
  debrief: {
    priority: "Readiness debrief",
    prompt: "Review the cues, action sequence, and consequence.",
    hint: "A warm door and smoke below it indicate that opening it may expose you to fire and smoke.",
  },
  error: {
    priority: "Live world unavailable",
    prompt: "The trainer will not substitute a fake live experience.",
    hint: "Retry after checking the world ID, provider capacity, and network.",
  },
};

export const RED_CROSS_FIRE_GUIDANCE_URL =
  "https://www.redcross.org/content/dam/redcross/atg/PDF_s/Preparedness___Disaster_Recovery/Disaster_Preparedness/Home_Fire/FireFAQs.pdf";

export const USFA_FIRE_RECOVERY_URL =
  "https://www.usfa.fema.gov/downloads/pdf/publications/fire_safety_trailer_curriculum.pdf";
