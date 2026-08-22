import type {
  GeneratedScenario,
  ScenarioPack,
  ScenarioParameters,
} from "./types";
import {
  validateGeneratedScenario,
  validateScenarioPack,
  validateScenarioParameters,
} from "./validation";

export { validateGeneratedScenario, validateScenarioPack, validateScenarioParameters };

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

export function composeScenario(pack: ScenarioPack, parameters: ScenarioParameters): GeneratedScenario {
  const packValidation = validateScenarioPack(pack);
  if (!packValidation.valid) throw new Error(`Invalid scenario pack: ${packValidation.errors.join("; ")}`);

  const parameterValidation = validateScenarioParameters(pack, parameters);
  if (!parameterValidation.valid) throw new Error(`Invalid scenario parameters: ${parameterValidation.errors.join("; ")}`);

  const parameterText = [
    `Environment: ${parameters.environment}.`,
    `Time: ${parameters.timeOfDay}.`,
    `Occupancy: ${parameters.occupancy}.`,
    `Infrastructure: ${parameters.infrastructureState}.`,
    `Severity: ${parameters.severity}.`,
  ].join(" ");
  const id = [pack.id, parameters.environment, parameters.timeOfDay, parameters.occupancy, parameters.infrastructureState, parameters.severity].join(":");
  const consequences = Object.fromEntries(
    Object.entries(pack.consequences).map(([key, consequence]) => [
      key,
      { ...consequence, prompt: `${consequence.prompt} ${parameterText}` },
    ])
  );
  const scenario: GeneratedScenario = {
    id,
    packId: pack.id,
    packVersion: pack.version,
    parameters,
    referenceImage: pack.referenceImage,
    reactorSeed: pack.reactorSeed + (stableHash(id) % 100000),
    basePrompt: `${pack.basePrompt} ${parameterText}`,
    cues: pack.cues.map((cue) => ({ ...cue, requiredVisualFacts: [...cue.requiredVisualFacts] })),
    decision: {
      ...pack.decisions[0],
      choices: pack.decisions[0].choices.map((choice) => ({ ...choice })),
      requiredCueIds: [...pack.decisions[0].requiredCueIds],
      recommendedChoiceIds: [...pack.decisions[0].recommendedChoiceIds],
    },
    consequences,
    debrief: { ...pack.debrief, source: { ...pack.debrief.source } },
    transferScenarioId: pack.transferScenarioId,
    validationStatus: pack.status,
  };
  const generatedValidation = validateGeneratedScenario(scenario);
  if (!generatedValidation.valid) throw new Error(`Invalid generated scenario: ${generatedValidation.errors.join("; ")}`);
  return scenario;
}
