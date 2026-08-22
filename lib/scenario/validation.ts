import type {
  GeneratedScenario,
  ScenarioPack,
  ScenarioParameters,
} from "./types";

export type ValidationResult = { valid: boolean; errors: string[] };

function matchesPartial(parameters: ScenarioParameters, partial: Partial<ScenarioParameters>): boolean {
  return Object.entries(partial).every(([key, value]) => parameters[key as keyof ScenarioParameters] === value);
}

export function validateScenarioParameters(pack: ScenarioPack, parameters: ScenarioParameters): ValidationResult {
  const errors: string[] = [];

  if (parameters.disasterType !== pack.disasterType) {
    errors.push(`disasterType must be ${pack.disasterType}`);
  }

  for (const [key, allowedValues] of Object.entries(pack.supportedParameters)) {
    const value = parameters[key as keyof ScenarioParameters];
    if (value !== undefined && allowedValues && !allowedValues.includes(String(value))) {
      errors.push(`${key}=${String(value)} is not supported by ${pack.id}`);
    }
  }

  if (pack.forbiddenCombinations.some((combination) => matchesPartial(parameters, combination))) {
    errors.push("parameter combination is forbidden by the reviewed scenario pack");
  }

  return { valid: errors.length === 0, errors };
}

export function validateScenarioPack(pack: ScenarioPack): ValidationResult {
  const errors: string[] = [];
  if (pack.status === "rejected") errors.push("rejected packs cannot be playable");
  if (pack.decisions.length === 0) errors.push("pack must contain a decision");
  if (pack.sourceReferences.length === 0) errors.push("pack must contain an authoritative source");

  for (const decision of pack.decisions) {
    if (decision.choices.length < 2) errors.push(`${decision.id} must contain at least two choices`);
    if (new Set(decision.choices.map((choice) => choice.id)).size !== decision.choices.length) {
      errors.push(`${decision.id} contains duplicate choice ids`);
    }
    for (const choice of decision.choices) {
      const consequence = pack.consequences[choice.consequenceStateId];
      if (!consequence) {
        errors.push(`${choice.id} references a missing consequence`);
      } else if (consequence.selectedChoiceId !== choice.id) {
        errors.push(`${choice.id} does not match its consequence selectedChoiceId`);
      }
    }
    for (const recommendedId of decision.recommendedChoiceIds) {
      if (!decision.choices.some((choice) => choice.id === recommendedId)) {
        errors.push(`${decision.id} recommends a missing choice`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateGeneratedScenario(scenario: GeneratedScenario): ValidationResult {
  const errors: string[] = [];
  if (scenario.validationStatus === "rejected") errors.push("rejected scenarios cannot be scored");
  if (!scenario.debrief.source.url) errors.push("scenario debrief must contain a source URL");
  if (scenario.decision.choices.length < 2) errors.push("scenario decision must contain at least two choices");
  for (const choice of scenario.decision.choices) {
    if (!scenario.consequences[choice.consequenceStateId]) {
      errors.push(`${choice.id} references a missing generated consequence`);
    }
  }
  return { valid: errors.length === 0, errors };
}
