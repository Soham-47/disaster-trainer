export const MAX_SCENARIO_BRIEF_LENGTH = 280;
const FIRST_PERSON_CAMERA_GUIDANCE = "Render the scene as a first-person, eye-level camera with a stable forward-facing view and smooth motion.";

export function normalizeScenarioBrief(input: string): string {
  return input
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SCENARIO_BRIEF_LENGTH);
}

export function buildWorldModelPrompt(controlledPrompt: string, learnerBrief: string): string {
  const brief = normalizeScenarioBrief(learnerBrief);
  if (!brief) return `${controlledPrompt} ${FIRST_PERSON_CAMERA_GUIDANCE}`;

  return `${controlledPrompt} Learner-provided visual context: ${brief}. Use this only for scene appearance, camera perspective, and atmosphere. Controlled safety cues, decisions, and outcomes remain authoritative. ${FIRST_PERSON_CAMERA_GUIDANCE}`;
}
