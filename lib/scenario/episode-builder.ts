import { validateScenarioPack, validateScenarioParameters } from "./validation";
import type {
  EpisodeGraph,
  EpisodeNode,
  HintDefinition,
  InteractionDefinition,
  ScenarioPack,
  ScenarioParameters,
  SceneSpec,
} from "./types";

const VISUAL_STABILITY_CONTRACT = "Upright eye-level first-person camera with a level horizon and no camera roll. Preserve room geometry, object identity, scale, lighting direction, and hazard locations between frames. Render no readable text, letters, numbers, captions, signage, labels, screens, logos, or watermarks anywhere in the world.";

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

function parameterText(parameters: ScenarioParameters): string {
  return `Environment: ${parameters.environment}. Time: ${parameters.timeOfDay}. Occupancy: ${parameters.occupancy}. Infrastructure: ${parameters.infrastructureState}. Severity: ${parameters.severity}.`;
}

function sceneFor(pack: ScenarioPack, parameters: ScenarioParameters, nodeId: string, deltaPrompt: string, fallbackAsset = pack.orientFallbackAsset, requiredFacts: string[] = [], forbiddenFacts: string[] = []): SceneSpec {
  return {
    referenceImage: pack.referenceImage,
    seed: pack.reactorSeed + (stableHash(`${pack.id}:${nodeId}`) % 100000),
    invariantPrompt: `${pack.basePrompt} ${parameterText(parameters)} Keep camera, layout, lighting, hazards, and first-person viewpoint fixed. ${VISUAL_STABILITY_CONTRACT}`,
    deltaPrompt,
    requiredFacts: [...requiredFacts],
    forbiddenFacts: [...forbiddenFacts, "model provides safety advice", "invented rooms", "invented actions"],
    cameraPreset: [],
    attentionWindow: nodeId.includes("investigate") || nodeId.includes("assess") ? "small" : "auto",
    fallbackAsset,
  };
}

function interaction(id: string, verb: InteractionDefinition["verb"], targetId: string, label: string, aliases: string[], nextNodeId: string, safetyClass: InteractionDefinition["safetyClass"], stateChanges: InteractionDefinition["stateChanges"] = []): InteractionDefinition {
  return { id, verb, targetId, label, aliases, nextNodeId, safetyClass, stateChanges };
}

function node(id: string, kind: EpisodeNode["kind"], title: string, priority: string, scene: SceneSpec, interactions: InteractionDefinition[], cueIds: string[] = [], checkpoint = false, hintIds: string[] = []): EpisodeNode {
  return { id, kind, title, immediatePriority: priority, scene, interactions, cueIds, checkpoint, hintIds };
}

export function composeEpisodeFromPack(pack: ScenarioPack, parameters: ScenarioParameters, options: { compact?: boolean } = {}): EpisodeGraph {
  const packValidation = validateScenarioPack(pack);
  if (!packValidation.valid) throw new Error(`Invalid scenario pack: ${packValidation.errors.join("; ")}`);
  const parameterValidation = validateScenarioParameters(pack, parameters);
  if (!parameterValidation.valid) throw new Error(`Invalid scenario parameters: ${parameterValidation.errors.join("; ")}`);

  const decision = pack.decisions[0];
  const safeChoice = decision.choices.find((choice) => choice.safetyClass === "safe") ?? decision.choices[0];
  const unsafeChoice = decision.choices.find((choice) => choice.safetyClass === "unsafe") ?? decision.choices[1] ?? decision.choices[0];
  const safeConsequence = pack.consequences[safeChoice.consequenceStateId];
  const unsafeConsequence = pack.consequences[unsafeChoice.consequenceStateId];
  const compact = options.compact ?? (pack.disasterType !== "structure_fire" && pack.disasterType !== "earthquake");
  const prefix = pack.disasterType === "structure_fire" ? "fire" : pack.disasterType;
  const hints: HintDefinition[] = [
    { id: `${prefix}-hint-priority`, tier: 1, text: "Pause and identify the immediate hazard before acting." },
    { id: `${prefix}-hint-cue`, tier: 2, text: pack.cues[0]?.learnerCopy ?? "Look for the strongest warning cue.", cueId: pack.cues[0]?.id },
    { id: `${prefix}-hint-principle`, tier: 3, text: pack.debrief.principle },
  ];
  const sharedForbidden = [...unsafeConsequence.forbiddenFacts, ...safeConsequence.forbiddenFacts];
  const nodes: Record<string, EpisodeNode> = {};

  if (!compact) {
    nodes[`${prefix}-orient`] = node(
      `${prefix}-orient`, "explore", "Orient", "Find the first warning cue.",
      sceneFor(pack, parameters, `${prefix}-orient`, "The environment is active but no new event occurs.", pack.orientFallbackAsset, pack.cues.flatMap((cue) => cue.requiredVisualFacts)),
      [interaction(`${prefix}-inspect-alarm`, "inspect", "alarm", "Inspect the alarm", ["inspect alarm", "check alarm", "listen to alarm"], `${prefix}-investigate-alarm`, "conditional", [{ key: "alarmInspected", value: true }])],
      pack.cues.map((cue) => cue.id), false, [`${prefix}-hint-priority`],
    );
    nodes[`${prefix}-investigate-alarm`] = node(
      `${prefix}-investigate-alarm`, "interaction", "Investigate the warning", "Confirm what the warning means.",
      sceneFor(pack, parameters, `${prefix}-investigate-alarm`, "The warning signal continues while the room stays fixed.", pack.orientFallbackAsset, pack.cues.flatMap((cue) => cue.requiredVisualFacts), sharedForbidden),
      [interaction(`${prefix}-inspect-smoke`, "inspect", "smoke", "Inspect the smoke and air", ["inspect smoke", "check smoke", "look at smoke"], `${prefix}-investigate-exit`, "conditional", [{ key: "smokeInspected", value: true }])],
      pack.cues.map((cue) => cue.id), false, [`${prefix}-hint-cue`],
    );
    nodes[`${prefix}-investigate-exit`] = node(
      `${prefix}-investigate-exit`, "interaction", "Assess the exit", "Check whether the exit is usable.",
      sceneFor(pack, parameters, `${prefix}-investigate-exit`, "The exit remains in the same location while the warning cue becomes clearer.", pack.orientFallbackAsset, pack.cues.flatMap((cue) => cue.requiredVisualFacts), sharedForbidden),
      [interaction(`${prefix}-inspect-exit`, "inspect", "exit", "Inspect the exit", ["inspect exit", "check exit", "check the door"], `${prefix}-assess-exit`, "conditional", [{ key: "exitInspected", value: true }])],
      pack.cues.map((cue) => cue.id), false, [`${prefix}-hint-cue`],
    );
    nodes[`${prefix}-assess-exit`] = node(
      `${prefix}-assess-exit`, "checkpoint", decision.prompt, "Choose the safest available response.",
      sceneFor(pack, parameters, `${prefix}-assess-exit`, "Hold the camera on the decision cue. Do not change the room layout.", pack.orientFallbackAsset, pack.cues.flatMap((cue) => cue.requiredVisualFacts), sharedForbidden),
      [
        interaction(`${prefix}-${safeChoice.id}`, safeChoice.safetyClass === "safe" ? "shelter" : "wait", safeChoice.id, safeChoice.label, [safeChoice.label, safeChoice.id.replaceAll("-", " ")], `${prefix}-consequence-safe`, safeChoice.safetyClass, [{ key: "chosenPath", value: safeChoice.id }]),
        interaction(`${prefix}-${unsafeChoice.id}`, unsafeChoice.safetyClass === "unsafe" ? "move" : "wait", unsafeChoice.id, unsafeChoice.label, [unsafeChoice.label, unsafeChoice.id.replaceAll("-", " ")], `${prefix}-consequence-unsafe`, unsafeChoice.safetyClass, [{ key: "chosenPath", value: unsafeChoice.id }]),
      ],
      pack.cues.map((cue) => cue.id), true, [`${prefix}-hint-principle`],
    );
    nodes[`${prefix}-consequence-safe`] = node(
      `${prefix}-consequence-safe`, "consequence", "Safer path", "Observe the immediate consequence.",
      sceneFor(pack, parameters, `${prefix}-consequence-safe`, safeConsequence.prompt, safeConsequence.fallbackAsset, safeConsequence.requiredFacts, safeConsequence.forbiddenFacts),
      [interaction(`${prefix}-continue-safe`, "wait", "consequence", "Continue", ["continue", "observe", "wait"], `${prefix}-outcome`, "safe")], [], false,
    );
    nodes[`${prefix}-consequence-unsafe`] = node(
      `${prefix}-consequence-unsafe`, "consequence", "Immediate consequence", "Notice what the unsafe exposure changes.",
      sceneFor(pack, parameters, `${prefix}-consequence-unsafe`, unsafeConsequence.prompt, unsafeConsequence.fallbackAsset, unsafeConsequence.requiredFacts, unsafeConsequence.forbiddenFacts),
      [interaction(`${prefix}-recover`, "move", "safer-position", "Move to a safer position", ["recover", "retreat", "move to safety"], `${prefix}-recovery`, "conditional", [{ key: "recovered", value: true }])], [], false,
    );
    nodes[`${prefix}-recovery`] = node(
      `${prefix}-recovery`, "interaction", "Recover", "Use the remaining safe option.",
      sceneFor(pack, parameters, `${prefix}-recovery`, "The learner regains a safer position without changing the room layout.", unsafeConsequence.fallbackAsset, unsafeConsequence.requiredFacts, unsafeConsequence.forbiddenFacts),
      [interaction(`${prefix}-communicate`, "communicate", "help", "Communicate for help", ["call for help", "signal for help", "communicate"], `${prefix}-outcome`, "conditional", [{ key: "helpRequested", value: true }])], [], false,
    );
    nodes[`${prefix}-outcome`] = node(
      `${prefix}-outcome`, "complete", "Scenario outcome", "Hold the scene and review the consequence.",
      sceneFor(pack, parameters, `${prefix}-outcome`, "The consequence settles into a stable final frame.", safeConsequence.fallbackAsset, [...safeConsequence.requiredFacts, ...unsafeConsequence.requiredFacts], sharedForbidden),
      [interaction(`${prefix}-finish`, "wait", "outcome", "Open the debrief", ["finish", "continue", "open debrief"], `${prefix}-debrief`, "conditional")], [], false,
    );
    nodes[`${prefix}-debrief`] = node(
      `${prefix}-debrief`, "debrief", "Debrief", "Compare the two futures and name the safety principle.",
      sceneFor(pack, parameters, `${prefix}-debrief`, "Freeze on the debrief context.", safeConsequence.fallbackAsset), [], [], false,
    );
  } else {
    const compactPrefix = `${prefix}-compact`;
    nodes[`${compactPrefix}-orient`] = node(`${compactPrefix}-orient`, "explore", "Orient", "Find the strongest warning cue.", sceneFor(pack, parameters, `${compactPrefix}-orient`, "The environment is active but stable.", pack.orientFallbackAsset, pack.cues.flatMap((cue) => cue.requiredVisualFacts)), [interaction(`${compactPrefix}-investigate`, "inspect", "hazard", "Inspect the hazard", ["inspect hazard", "check hazard", "look around"], `${compactPrefix}-investigate`, "conditional")], pack.cues.map((cue) => cue.id), false, [`${prefix}-hint-priority`]);
    nodes[`${compactPrefix}-investigate`] = node(`${compactPrefix}-investigate`, "interaction", "Investigate", "Confirm the warning before choosing.", sceneFor(pack, parameters, `${compactPrefix}-investigate`, "Keep the camera and layout fixed while the cue becomes visible.", pack.orientFallbackAsset, pack.cues.flatMap((cue) => cue.requiredVisualFacts)), [interaction(`${compactPrefix}-decision`, "inspect", "route", "Assess the available route", ["assess route", "check route", "inspect route"], `${compactPrefix}-decision`, "conditional")], pack.cues.map((cue) => cue.id), false, [`${prefix}-hint-cue`]);
    nodes[`${compactPrefix}-decision`] = node(`${compactPrefix}-decision`, "checkpoint", decision.prompt, "Choose the safest available response.", sceneFor(pack, parameters, `${compactPrefix}-decision`, "Hold the camera on the decision cue.", pack.orientFallbackAsset, pack.cues.flatMap((cue) => cue.requiredVisualFacts), sharedForbidden), [interaction(`${compactPrefix}-${safeChoice.id}`, "shelter", safeChoice.id, safeChoice.label, [safeChoice.label, safeChoice.id.replaceAll("-", " ")], `${compactPrefix}-safe`, safeChoice.safetyClass), interaction(`${compactPrefix}-${unsafeChoice.id}`, "move", unsafeChoice.id, unsafeChoice.label, [unsafeChoice.label, unsafeChoice.id.replaceAll("-", " ")], `${compactPrefix}-unsafe`, unsafeChoice.safetyClass)], pack.cues.map((cue) => cue.id), true, [`${prefix}-hint-principle`]);
    nodes[`${compactPrefix}-safe`] = node(`${compactPrefix}-safe`, "consequence", "Safer continuation", "Observe the controlled consequence.", sceneFor(pack, parameters, `${compactPrefix}-safe`, safeConsequence.prompt, safeConsequence.fallbackAsset, safeConsequence.requiredFacts, safeConsequence.forbiddenFacts), [interaction(`${compactPrefix}-safe-finish`, "wait", "outcome", "Continue to debrief", ["continue", "finish", "observe"], `${compactPrefix}-debrief`, "safe")]);
    nodes[`${compactPrefix}-unsafe`] = node(`${compactPrefix}-unsafe`, "consequence", "Unsafe continuation", "Observe the controlled consequence.", sceneFor(pack, parameters, `${compactPrefix}-unsafe`, unsafeConsequence.prompt, unsafeConsequence.fallbackAsset, unsafeConsequence.requiredFacts, unsafeConsequence.forbiddenFacts), [interaction(`${compactPrefix}-unsafe-finish`, "wait", "outcome", "Continue to debrief", ["continue", "finish", "observe"], `${compactPrefix}-debrief`, "unsafe")]);
    nodes[`${compactPrefix}-debrief`] = node(`${compactPrefix}-debrief`, "debrief", "Debrief", "Name the safety principle before transfer.", sceneFor(pack, parameters, `${compactPrefix}-debrief`, "Freeze on the debrief context.", safeConsequence.fallbackAsset), []);
  }

  const id = `${pack.id}:${parameters.environment}:${parameters.timeOfDay}:${parameters.occupancy}:${parameters.infrastructureState}:${parameters.severity}${compact ? ":compact" : ":deep"}`;
  return {
    id,
    version: pack.version,
    disasterType: pack.disasterType,
    startNodeId: `${prefix}-${compact ? "compact-" : ""}orient`,
    nodes,
    cues: pack.cues.map((cue) => ({ ...cue, requiredVisualFacts: [...cue.requiredVisualFacts] })),
    hints,
    debrief: { ...pack.debrief, source: { ...pack.debrief.source } },
    transferEpisodeId: pack.transferScenarioId,
    sourceReferences: pack.sourceReferences.map((source) => ({ ...source })),
  };
}
