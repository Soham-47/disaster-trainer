import type {
  ActionIntent,
  EpisodeGraph,
  InteractionDefinition,
  SimulationCheckpoint,
  WorldState,
} from "@/lib/scenario/types";

export type AssessmentEvent = {
  kind: "action" | "hint" | "rewind";
  sequence: number;
  actionId?: string;
  nodeId: string;
  safetyClass?: InteractionDefinition["safetyClass"];
  hintId?: string;
};

export type SimulationState = {
  graph: EpisodeGraph | null;
  world: WorldState | null;
  checkpoints: Record<string, SimulationCheckpoint>;
  eventLog: AssessmentEvent[];
  errorMessage: string | null;
};

export type SimulationAction =
  | { type: "START_EPISODE"; graph: EpisodeGraph; resources?: string[] }
  | { type: "DISCOVER_CUE"; cueId: string }
  | { type: "SUBMIT_ACTION"; intent: ActionIntent }
  | { type: "REQUEST_HINT"; hintId: string }
  | { type: "ADVANCE_NODE"; nodeId: string }
  | { type: "SAVE_CHECKPOINT"; checkpoint: SimulationCheckpoint }
  | { type: "START_REWIND" }
  | { type: "RESTORE_CHECKPOINT"; checkpointId: string }
  | { type: "START_TRANSFER"; graph: EpisodeGraph; resources?: string[] }
  | { type: "COMPLETE_EPISODE" }
  | { type: "FAIL"; error: string }
  | { type: "RESTART" };

export const emptySimulationState: SimulationState = {
  graph: null,
  world: null,
  checkpoints: {},
  eventLog: [],
  errorMessage: null,
};

export function createSimulationState(): SimulationState {
  return { ...emptySimulationState, checkpoints: {}, eventLog: [] };
}

function statusForNode(graph: EpisodeGraph, nodeId: string): WorldState["status"] {
  const node = graph.nodes[nodeId];
  const kind = node?.kind;
  if (kind === "debrief") return "debrief";
  if (kind === "transfer") return "transfer";
  // A complete-kind node may still be a visible outcome checkpoint with one
  // final interaction (for example, “Open the debrief”). Keep it interactive
  // until that exit is taken; only terminal complete nodes end the simulation.
  if (kind === "complete" && (node?.interactions.length ?? 0) === 0) return "complete";
  return "active";
}

function createWorld(graph: EpisodeGraph, resources: string[] = []): WorldState {
  return {
    episodeId: graph.id,
    nodeId: graph.startNodeId,
    checkpointId: null,
    variables: {},
    hazardLevels: {},
    availableResources: [...resources],
    discoveredCueIds: [],
    completedActionIds: [],
    hintsUsed: 0,
    elapsedMs: 0,
    status: statusForNode(graph, graph.startNodeId),
  };
}

function copyWorld(world: WorldState): WorldState {
  return {
    ...world,
    variables: { ...world.variables },
    hazardLevels: { ...world.hazardLevels },
    availableResources: [...world.availableResources],
    discoveredCueIds: [...world.discoveredCueIds],
    completedActionIds: [...world.completedActionIds],
  };
}

function findInteraction(graph: EpisodeGraph, world: WorldState, intent: ActionIntent): InteractionDefinition | null {
  const node = graph.nodes[world.nodeId];
  if (!node) return null;
  return node.interactions.find((interaction) =>
    interaction.verb === intent.verb &&
    interaction.targetId === intent.targetId &&
    (!interaction.toolId || interaction.toolId === intent.toolId) &&
    !world.completedActionIds.includes(interaction.id)
  ) ?? null;
}

function applyStateChanges(world: WorldState, changes: InteractionDefinition["stateChanges"]): WorldState {
  const next = copyWorld(world);
  for (const change of changes) {
    if (change.key.startsWith("hazard.")) {
      const hazardId = change.key.slice("hazard.".length);
      if (typeof change.value === "number") next.hazardLevels[hazardId] = change.value;
      continue;
    }
    if (change.key.startsWith("resource.add.")) {
      const resourceId = change.key.slice("resource.add.".length);
      if (!next.availableResources.includes(resourceId)) next.availableResources.push(resourceId);
      continue;
    }
    if (change.key.startsWith("resource.remove.")) {
      const resourceId = change.key.slice("resource.remove.".length);
      next.availableResources = next.availableResources.filter((item) => item !== resourceId);
      continue;
    }
    next.variables[change.key] = change.value;
  }
  return next;
}

function appendEvent(state: SimulationState, event: Omit<AssessmentEvent, "sequence">): AssessmentEvent[] {
  return [...state.eventLog, { ...event, sequence: state.eventLog.length + 1 }];
}

export function simulationReducer(state: SimulationState, action: SimulationAction): SimulationState {
  switch (action.type) {
    case "START_EPISODE": {
      return {
        graph: action.graph,
        world: createWorld(action.graph, action.resources),
        checkpoints: {},
        eventLog: [],
        errorMessage: null,
      };
    }
    case "START_TRANSFER": {
      return {
        graph: action.graph,
        world: createWorld(action.graph, action.resources),
        checkpoints: {},
        eventLog: [],
        errorMessage: null,
      };
    }
    case "DISCOVER_CUE": {
      if (!state.graph || !state.world || !state.graph.cues.some((cue) => cue.id === action.cueId)) return state;
      if (state.world.discoveredCueIds.includes(action.cueId)) return state;
      const world = copyWorld(state.world);
      world.discoveredCueIds.push(action.cueId);
      return { ...state, world };
    }
    case "SUBMIT_ACTION": {
      if (!state.graph || !state.world || state.world.status !== "active") return state;
      const interaction = findInteraction(state.graph, state.world, action.intent);
      if (!interaction) return state;
      let world = applyStateChanges(state.world, interaction.stateChanges);
      world.completedActionIds = [...world.completedActionIds, interaction.id];
      world.nodeId = interaction.nextNodeId;
      world.status = statusForNode(state.graph, interaction.nextNodeId);
      return {
        ...state,
        world,
        eventLog: appendEvent(state, {
          kind: "action",
          actionId: interaction.id,
          nodeId: state.world.nodeId,
          safetyClass: interaction.safetyClass,
        }),
      };
    }
    case "REQUEST_HINT": {
      if (!state.graph || !state.world) return state;
      const node = state.graph.nodes[state.world.nodeId];
      if (!node?.hintIds.includes(action.hintId) || !state.graph.hints.some((hint) => hint.id === action.hintId)) return state;
      const world = copyWorld(state.world);
      world.hintsUsed += 1;
      return {
        ...state,
        world,
        eventLog: appendEvent(state, { kind: "hint", hintId: action.hintId, nodeId: state.world.nodeId }),
      };
    }
    case "ADVANCE_NODE": {
      if (!state.graph || !state.world || !state.graph.nodes[action.nodeId]) return state;
      const world = copyWorld(state.world);
      world.nodeId = action.nodeId;
      world.status = statusForNode(state.graph, action.nodeId);
      return { ...state, world };
    }
    case "SAVE_CHECKPOINT": {
      if (!state.world) return state;
      const checkpoint = structuredClone(action.checkpoint);
      const world = copyWorld(state.world);
      world.checkpointId = checkpoint.id;
      checkpoint.worldState = copyWorld(world);
      return {
        ...state,
        world,
        checkpoints: { ...state.checkpoints, [checkpoint.id]: checkpoint },
      };
    }
    case "START_REWIND": {
      if (!state.world) return state;
      const world = copyWorld(state.world);
      world.status = "rewinding";
      return { ...state, world };
    }
    case "RESTORE_CHECKPOINT": {
      const checkpoint = state.checkpoints[action.checkpointId];
      if (!checkpoint) return state;
      return {
        ...state,
        world: copyWorld(checkpoint.worldState),
        eventLog: appendEvent(state, { kind: "rewind", nodeId: checkpoint.nodeId }),
      };
    }
    case "COMPLETE_EPISODE": {
      if (!state.world) return state;
      const world = copyWorld(state.world);
      world.status = "complete";
      return { ...state, world };
    }
    case "FAIL": {
      const world = state.world ? copyWorld(state.world) : null;
      if (world) world.status = "error";
      return { ...state, world, errorMessage: action.error };
    }
    case "RESTART":
      return createSimulationState();
    default:
      return state;
  }
}
