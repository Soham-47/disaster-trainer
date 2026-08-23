export type SafetyClass = "safe" | "unsafe" | "conditional";
export type ValidationStatus = "approved" | "illustrative" | "rejected";
export type GenerationMode = "live" | "fallback";
export type ExperienceState =
  | "entry"
  | "orient"
  | "decision"
  | "consequence"
  | "rewind"
  | "alternative"
  | "debrief"
  | "transfer"
  | "result"
  | "error";

export type DisasterType =
  | "structure_fire"
  | "earthquake"
  | "flash_flood"
  | "wildfire"
  | "cyclone"
  | "tornado"
  | "tsunami"
  | "landslide"
  | "gas_leak"
  | "extreme_heat";

export type NodeKind =
  | "explore"
  | "interaction"
  | "hazard"
  | "checkpoint"
  | "consequence"
  | "debrief"
  | "transfer"
  | "complete";

export type ActionVerb =
  | "inspect"
  | "move"
  | "use"
  | "communicate"
  | "assist"
  | "shelter"
  | "wait";

export type StateChange = {
  key: string;
  value: boolean | number | string;
};

export type SceneSpec = {
  referenceImage: string;
  seed: number;
  invariantPrompt: string;
  deltaPrompt: string;
  requiredFacts: string[];
  forbiddenFacts: string[];
  cameraPreset: number[];
  attentionWindow: "small" | "large" | "auto";
  fallbackAsset: string;
};

export type HintDefinition = {
  id: string;
  tier: 1 | 2 | 3;
  text: string;
  cueId?: string;
};

export type DebriefDefinition = {
  warningCue: string;
  recommendedAction: string;
  principle: string;
  source: SourceReference;
};

export type InteractionDefinition = {
  id: string;
  verb: ActionVerb;
  targetId: string;
  label: string;
  aliases: string[];
  toolId?: string;
  safetyClass: SafetyClass;
  nextNodeId: string;
  stateChanges: StateChange[];
};

export type EpisodeNode = {
  id: string;
  kind: NodeKind;
  title: string;
  immediatePriority: string;
  scene: SceneSpec;
  cueIds: string[];
  interactions: InteractionDefinition[];
  checkpoint: boolean;
  hintIds: string[];
};

export type EpisodeGraph = {
  id: string;
  version: string;
  disasterType: DisasterType;
  startNodeId: string;
  nodes: Record<string, EpisodeNode>;
  cues: ControlledCue[];
  hints: HintDefinition[];
  debrief: DebriefDefinition;
  transferEpisodeId: string;
  sourceReferences: SourceReference[];
};

export type WorldState = {
  episodeId: string;
  nodeId: string;
  checkpointId: string | null;
  variables: Record<string, boolean | number | string>;
  hazardLevels: Record<string, number>;
  availableResources: string[];
  discoveredCueIds: string[];
  completedActionIds: string[];
  hintsUsed: number;
  elapsedMs: number;
  status: "loading" | "active" | "rewinding" | "debrief" | "transfer" | "complete" | "error";
};

export type ActionIntent = {
  verb: ActionVerb;
  targetId: string;
  toolId?: string;
  source: "hotspot" | "action-wheel" | "text";
};

export type SimulationCheckpoint = {
  id: string;
  nodeId: string;
  frameDataUrl: string;
  worldState: WorldState;
  createdAt: number;
};

export type ScenarioParameters = {
  disasterType: DisasterType;
  environment: "apartment" | "hotel" | "office" | "school" | "vehicle" | "street" | "shopping_mall";
  timeOfDay: "day" | "night";
  occupancy: "alone" | "family" | "crowd";
  mobilityConstraint: "none" | "child" | "elderly_person";
  infrastructureState: "normal" | "power_outage" | "blocked_exit" | "network_failure";
  severity: "early_warning" | "active_danger";
};

export type SourceReference = {
  title: string;
  organization: string;
  url: string;
  reviewedAt: string;
};

export type ChoiceDefinition = {
  id: string;
  label: string;
  safetyClass: SafetyClass;
  consequenceStateId: string;
};

export type DecisionTemplate = {
  id: string;
  prompt: string;
  requiredCueIds: string[];
  choices: ChoiceDefinition[];
  recommendedChoiceIds: string[];
};

export type DisasterPack = {
  id: string;
  version: string;
  disasterType: DisasterType;
  status: ValidationStatus;
  supportedParameters: Partial<Record<keyof ScenarioParameters, string[]>>;
  forbiddenCombinations: Array<Partial<ScenarioParameters>>;
  decisions: DecisionTemplate[];
  sourceReferences: SourceReference[];
};

export type ScenarioPack = DisasterPack & {
  referenceImage: string;
  reactorSeed: number;
  basePrompt: string;
  orientFallbackAsset: string;
  cues: ControlledCue[];
  consequences: Record<string, ConsequenceDefinition>;
  debrief: GeneratedScenario["debrief"];
  transferScenarioId: string;
};

export type ControlledCue = {
  id: string;
  learnerCopy: string;
  requiredVisualFacts: string[];
};

export type ConsequenceDefinition = {
  stateId: string;
  selectedChoiceId: string;
  prompt: string;
  requiredFacts: string[];
  forbiddenFacts: string[];
  durationSeconds: number;
  fallbackAsset: string;
};

export type GeneratedScenario = {
  id: string;
  packId: string;
  packVersion: string;
  parameters: ScenarioParameters;
  referenceImage: string;
  reactorSeed: number;
  basePrompt: string;
  orientFallbackAsset: string;
  cues: ControlledCue[];
  decision: DecisionTemplate;
  consequences: Record<string, ConsequenceDefinition>;
  debrief: {
    warningCue: string;
    recommendedAction: string;
    principle: string;
    source: SourceReference;
  };
  transferScenarioId: string;
  validationStatus: ValidationStatus;
};

export type SessionResult = {
  sessionId: string;
  scenarioId: string;
  initialDecisionId: string;
  initialSafetyClass: SafetyClass;
  transferDecisionId: string;
  transferSuccessful: boolean;
  improved: boolean;
  generationMode: GenerationMode;
  generationValidated: boolean;
  scoreEligible: boolean;
  startedAt: string;
  completedAt: string;
};
