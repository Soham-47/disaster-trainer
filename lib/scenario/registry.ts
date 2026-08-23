import { composeScenario } from "./engine";
import type { DisasterType, GeneratedScenario, ScenarioPack, ScenarioParameters } from "./types";
import { structureFirePack } from "../../scenarios/structure-fire-v1";
import { earthquakePack } from "../../scenarios/earthquake-v1";
import { flashFloodPack } from "../../scenarios/flash-flood-v1";
import { wildfirePack } from "../../scenarios/wildfire-v1";
import { cyclonePack } from "../../scenarios/cyclone-v1";

export const SUPPORTED_DISASTER_TYPES = [
  "structure_fire",
  "earthquake",
  "flash_flood",
  "wildfire",
  "cyclone",
] as const satisfies readonly DisasterType[];

type SupportedDisasterType = (typeof SUPPORTED_DISASTER_TYPES)[number];

const PACKS: Record<SupportedDisasterType, ScenarioPack> = {
  structure_fire: structureFirePack,
  earthquake: earthquakePack,
  flash_flood: flashFloodPack,
  wildfire: wildfirePack,
  cyclone: cyclonePack,
};

const DEFAULT_PARAMETERS: Record<SupportedDisasterType, ScenarioParameters> = {
  structure_fire: {
    disasterType: "structure_fire",
    environment: "apartment",
    timeOfDay: "night",
    occupancy: "alone",
    mobilityConstraint: "none",
    infrastructureState: "normal",
    severity: "active_danger",
  },
  earthquake: {
    disasterType: "earthquake",
    environment: "apartment",
    timeOfDay: "night",
    occupancy: "alone",
    mobilityConstraint: "none",
    infrastructureState: "power_outage",
    severity: "active_danger",
  },
  flash_flood: {
    disasterType: "flash_flood",
    environment: "apartment",
    timeOfDay: "day",
    occupancy: "family",
    mobilityConstraint: "none",
    infrastructureState: "power_outage",
    severity: "active_danger",
  },
  wildfire: {
    disasterType: "wildfire",
    environment: "apartment",
    timeOfDay: "day",
    occupancy: "family",
    mobilityConstraint: "none",
    infrastructureState: "normal",
    severity: "active_danger",
  },
  cyclone: {
    disasterType: "cyclone",
    environment: "apartment",
    timeOfDay: "night",
    occupancy: "family",
    mobilityConstraint: "none",
    infrastructureState: "power_outage",
    severity: "active_danger",
  },
};

const TRANSFER_PARAMETERS: Record<SupportedDisasterType, ScenarioParameters> = {
  structure_fire: {
    ...DEFAULT_PARAMETERS.structure_fire,
    environment: "hotel",
    occupancy: "family",
    timeOfDay: "day",
  },
  earthquake: {
    ...DEFAULT_PARAMETERS.earthquake,
    environment: "office",
    timeOfDay: "day",
  },
  flash_flood: {
    ...DEFAULT_PARAMETERS.flash_flood,
    environment: "office",
    timeOfDay: "night",
  },
  wildfire: {
    ...DEFAULT_PARAMETERS.wildfire,
    environment: "vehicle",
    timeOfDay: "night",
  },
  cyclone: {
    ...DEFAULT_PARAMETERS.cyclone,
    environment: "hotel",
    timeOfDay: "day",
  },
};

const DETECTION_RULES: Array<{ type: SupportedDisasterType; patterns: RegExp[] }> = [
  { type: "wildfire", patterns: [/\bwildfire\b/, /\bforest fire\b/, /\bbrush fire\b/, /\bbush fire\b/] },
  { type: "flash_flood", patterns: [/\bflash flood\b/, /\bflood(?:ing|water)?\b/, /\bstorm surge\b/] },
  { type: "cyclone", patterns: [/\bcyclone\b/, /\bhurricane\b/, /\btyphoon\b/, /\btropical storm\b/] },
  { type: "earthquake", patterns: [/\bearthquake\b/, /\baftershock\b/, /\btremor\b/, /\bseismic\b/] },
  { type: "structure_fire", patterns: [/\bstructure fire\b/, /\bbuilding fire\b/, /\bapartment fire\b/, /\bfire\b/, /\bsmoke\b/, /\bblaze\b/] },
];

export type ScenarioSelection = {
  disasterType: SupportedDisasterType;
  scenario: GeneratedScenario;
  transferScenario: GeneratedScenario;
};

export function detectDisasterType(description: string): SupportedDisasterType | null {
  const normalized = description.trim().toLowerCase();
  if (!normalized) return "structure_fire";

  return DETECTION_RULES.find((rule) => rule.patterns.some((pattern) => pattern.test(normalized)))?.type ?? null;
}

export function getScenarioPack(disasterType: DisasterType): ScenarioPack | undefined {
  return PACKS[disasterType as SupportedDisasterType];
}

export function getAllScenarioPacks(): ScenarioPack[] {
  return SUPPORTED_DISASTER_TYPES.map((disasterType) => PACKS[disasterType]);
}

export function resolveScenarioSelection(description: string): ScenarioSelection | null {
  const disasterType = detectDisasterType(description);
  if (!disasterType) return null;

  const pack = PACKS[disasterType];
  return {
    disasterType,
    scenario: composeScenario(pack, DEFAULT_PARAMETERS[disasterType]),
    transferScenario: composeScenario(pack, TRANSFER_PARAMETERS[disasterType]),
  };
}

export function composeScenarioFromDescription(description: string): GeneratedScenario | null {
  return resolveScenarioSelection(description)?.scenario ?? null;
}

