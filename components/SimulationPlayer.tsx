"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ActionWheel } from "@/components/ActionWheel";
import { AvailableResources } from "@/components/AvailableResources";
import { CommandBar } from "@/components/CommandBar";
import { EntryScreen } from "@/components/EntryScreen";
import { GenerationStatus } from "@/components/GenerationStatus";
import { HintPanel } from "@/components/HintPanel";
import { InteractionPrompt } from "@/components/InteractionPrompt";
import { ScenarioTimeline } from "@/components/ScenarioTimeline";
import { SimulationHUD } from "@/components/SimulationHUD";
import { WorldViewport } from "@/components/WorldViewport";
import { reactorClient, type WorldModelAdapter, type WorldModelNavigationInput } from "@/lib/reactor/client";
import type { WorldModelStatus } from "@/lib/reactor/events";
import { composeEpisodeFromPack } from "@/lib/scenario/episode-builder";
import { getScenarioPack, resolveScenarioSelection } from "@/lib/scenario/registry";
import type { ActionIntent, EpisodeGraph, InteractionDefinition, SimulationCheckpoint } from "@/lib/scenario/types";
import { createSimulationState, simulationReducer, type SimulationState } from "@/lib/player/simulation-reducer";
import { scoreSimulation } from "@/lib/scenario/scoring";

type SimulationPlayerProps = { adapter?: WorldModelAdapter };
type RunPhase = "entry" | "primary" | "transfer" | "result";

function modeOf(adapter: WorldModelAdapter): "live" | "fallback" {
  const candidate = adapter as WorldModelAdapter & { getMode?: () => "live" | "fallback" };
  return candidate.getMode?.() ?? "live";
}

function fallbackAssetOf(adapter: WorldModelAdapter, fallback: string): string {
  const candidate = adapter as WorldModelAdapter & { getActiveFallbackAsset?: () => string | null };
  return candidate.getActiveFallbackAsset?.() ?? fallback;
}

function fallbackReasonOf(adapter: WorldModelAdapter): string | null {
  const candidate = adapter as WorldModelAdapter & { getFallbackReason?: () => string | null };
  return candidate.getFallbackReason?.() ?? null;
}

export function SimulationPlayer({ adapter = reactorClient }: SimulationPlayerProps) {
  const [simulation, dispatch] = useReducer(simulationReducer, undefined, createSimulationState);
  const [phase, setPhase] = useState<RunPhase>("entry");
  const [transferGraph, setTransferGraph] = useState<EpisodeGraph | null>(null);
  const [status, setStatus] = useState<WorldModelStatus>((adapter as WorldModelAdapter & { getStatus?: () => WorldModelStatus }).getStatus?.() ?? "idle");
  const [mode, setMode] = useState<"live" | "fallback">(modeOf(adapter));
  const [fallbackAsset, setFallbackAsset] = useState("/fallbacks/fire-bedroom-orient.mp4");
  const [fallbackReason, setFallbackReason] = useState<string | null>(fallbackReasonOf(adapter));
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [isRewinding, setIsRewinding] = useState(false);
  const [sessionAssessment, setSessionAssessment] = useState<ReturnType<typeof scoreSimulation> | null>(null);
  const frameRef = useRef<string | null>(null);
  const primaryStateRef = useRef<SimulationState | null>(null);

  useEffect(() => {
    const unsubscribe = adapter.onStatus((nextStatus) => {
      setStatus(nextStatus);
      setMode(modeOf(adapter));
      setFallbackReason(fallbackReasonOf(adapter));
      if (simulation.graph) setFallbackAsset(fallbackAssetOf(adapter, fallbackAsset));
    });
    return unsubscribe;
  }, [adapter, fallbackAsset, simulation.graph]);

  const streamFrame = useCallback((frame: unknown) => {
    const liveFrame = frame as { stream?: MediaStream; track?: MediaStreamTrack } | null;
    const nextStream = liveFrame?.stream ?? (liveFrame?.track && typeof MediaStream !== "undefined" ? new MediaStream([liveFrame.track]) : null);
    setLiveStream((previousStream) => {
      if (previousStream === nextStream) return previousStream;
      previousStream?.getTracks().forEach((track) => track.stop());
      return nextStream;
    });
  }, []);

  useEffect(() => () => {
    streamFrame(null);
    void adapter.stopNavigation().catch(() => undefined);
    void adapter.reset();
  }, [adapter, streamFrame]);

  const startWorld = useCallback(async (graph: EpisodeGraph) => {
    const startNode = graph.nodes[graph.startNodeId];
    setFallbackAsset(startNode.scene.fallbackAsset);
    setCapturedFrame(null);
    frameRef.current = null;
    try {
      await adapter.start({
        referenceImage: startNode.scene.referenceImage,
        prompt: `${startNode.scene.invariantPrompt} ${startNode.scene.deltaPrompt}`,
        seed: startNode.scene.seed,
        attentionWindow: startNode.scene.attentionWindow,
        fallbackAsset: startNode.scene.fallbackAsset,
        onFrame: streamFrame,
      });
      setStartupError(null);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Live world unavailable";
      await adapter.useFallback(startNode.scene.fallbackAsset, reason);
      setStartupError(`Live LingBot is unavailable; this run is using a prepared continuation. ${reason}`);
    }
    setStatus((adapter as WorldModelAdapter & { getStatus?: () => WorldModelStatus }).getStatus?.() ?? "generating");
    setMode(modeOf(adapter));
  }, [adapter, streamFrame]);

  const startScenario = async (brief: string) => {
    const selection = resolveScenarioSelection(brief);
    if (!selection) {
      setStartupError("Choose a reviewed starter family: fire, earthquake, flash flood, wildfire, or cyclone.");
      return;
    }
    const pack = getScenarioPack(selection.disasterType);
    if (!pack) return;
    const graph = composeEpisodeFromPack(pack, selection.scenario.parameters);
    const transfer = composeEpisodeFromPack(pack, selection.transferScenario.parameters, { compact: true });
    setPending(true);
    setSessionAssessment(null);
    setTransferGraph(transfer);
    setPhase("primary");
    await startWorld(graph);
    dispatch({ type: "START_EPISODE", graph, resources: ["phone"] });
    setPending(false);
  };

  const waitForCapturedFrame = async (): Promise<string> => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (frameRef.current) return frameRef.current;
      try {
        const adapterFrame = await adapter.captureCheckpoint();
        if (adapterFrame) return adapterFrame;
      } catch {
        // The viewport may not have completed its canvas capture yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error("The decision frame could not be captured");
  };

  const submitIntent = async (intent: ActionIntent) => {
    const graph = simulation.graph;
    const world = simulation.world;
    if (!graph || !world || world.status !== "active" || pending) return;
    const currentNode = graph.nodes[world.nodeId];
    const interaction = currentNode.interactions.find((candidate) => candidate.verb === intent.verb && candidate.targetId === intent.targetId && (!candidate.toolId || candidate.toolId === intent.toolId));
    if (!interaction) return;
    const nextNode = graph.nodes[interaction.nextNodeId];
    if (!nextNode) return;

    setPending(true);
    setFallbackAsset(nextNode.scene.fallbackAsset);
    try {
      if (currentNode.checkpoint) {
        await adapter.stopNavigation();
        await adapter.pause().catch(() => undefined);
        const frameDataUrl = await waitForCapturedFrame();
        const checkpoint: SimulationCheckpoint = {
          id: `${graph.id}:${currentNode.id}`,
          nodeId: currentNode.id,
          frameDataUrl,
          worldState: structuredClone(world),
          createdAt: Date.now(),
        };
        dispatch({ type: "SAVE_CHECKPOINT", checkpoint });
        setIsRewinding(true);
        dispatch({ type: "SUBMIT_ACTION", intent });
        await adapter.restartFromCheckpoint({
          frameDataUrl,
          prompt: `${nextNode.scene.invariantPrompt} ${nextNode.scene.deltaPrompt}`,
          seed: nextNode.scene.seed,
          attentionWindow: nextNode.scene.attentionWindow,
          fallbackAsset: nextNode.scene.fallbackAsset,
        });
        setIsRewinding(false);
      } else {
        dispatch({ type: "SUBMIT_ACTION", intent });
        if (modeOf(adapter) === "live") await adapter.applySceneDelta(nextNode.scene);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Prepared continuation selected";
      await adapter.useFallback(nextNode.scene.fallbackAsset, reason);
      setFallbackReason(reason);
      dispatch({ type: "SUBMIT_ACTION", intent });
      setIsRewinding(false);
    } finally {
      setPending(false);
    }
  };

  const handleHint = (hintId: string) => dispatch({ type: "REQUEST_HINT", hintId });

  const continueToTransfer = async () => {
    if (!transferGraph || !simulation.world || pending) return;
    primaryStateRef.current = simulation;
    setPending(true);
    await startWorld(transferGraph);
    dispatch({ type: "START_TRANSFER", graph: transferGraph, resources: ["phone"] });
    setPhase("transfer");
    setPending(false);
  };

  const finishSession = () => {
    const primary = primaryStateRef.current;
    if (!primary || !simulation.world) return;
    setSessionAssessment(scoreSimulation(primary, simulation, modeOf(adapter) === "live"));
    setPhase("result");
  };

  const restart = async () => {
    setPending(true);
    await adapter.reset();
    dispatch({ type: "RESTART" });
    setPhase("entry");
    setTransferGraph(null);
    setSessionAssessment(null);
    setStartupError(null);
    setCapturedFrame(null);
    frameRef.current = null;
    setPending(false);
  };

  const graph = simulation.graph;
  const world = simulation.world;
  const currentNode = graph && world ? graph.nodes[world.nodeId] : null;
  const nodeList = graph ? Object.values(graph.nodes) : [];
  const nodeIndex = currentNode ? Math.max(1, nodeList.findIndex((node) => node.id === currentNode.id) + 1) : 1;
  const activeInteractions = currentNode?.interactions ?? [];
  const primaryHintIds = currentNode?.hintIds ?? [];
  const activeHints = graph?.hints.filter((hint) => primaryHintIds.includes(hint.id)) ?? [];
  const usedHintIds = simulation.eventLog.flatMap((event) => event.hintId ? [event.hintId] : []);

  if (phase === "entry") {
    return <main className="min-h-screen bg-neutral-950 px-4 py-6 text-neutral-100"><div className="mx-auto max-w-7xl"><EntryScreen onStart={(brief) => void startScenario(brief)} disabled={pending} errorMessage={startupError} /></div></main>;
  }

  if (phase === "result") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-100">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-neutral-900 p-8 text-center shadow-2xl">
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-300">Readiness assessment</p>
          <h1 className="mt-3 text-3xl font-semibold text-white">You experienced two futures.</h1>
          <p className="mt-4 text-sm leading-6 text-neutral-300">{sessionAssessment?.summary ?? "The scenario was completed."}</p>
          <p className="mt-5 text-xs text-neutral-400">{sessionAssessment?.scoreEligible ? "Live run eligible for assessment." : "Prepared continuation used; safety state was recorded but this run is not scored."}</p>
          <button type="button" onClick={() => void restart()} className="mt-7 rounded-xl bg-amber-300 px-5 py-3 text-sm font-bold text-neutral-950 hover:bg-amber-200">Run another scenario</button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-neutral-950 px-4 py-3 md:px-8">
        <div><p className="text-xs font-mono uppercase tracking-[0.28em] text-amber-300">Counterfactual Disaster Trainer</p><p className="mt-1 text-xs text-neutral-500">Interactive preparedness simulation · constrained safety truth</p></div>
        <GenerationStatus status={status} mode={mode} modelName="LingBot World 2" fallbackReason={mode === "fallback" ? fallbackReason : null} />
      </header>
      <section className="relative mx-auto h-[calc(100vh-73px)] min-h-[640px] max-w-[1600px] overflow-hidden bg-black">
        <WorldViewport status={status} mode={mode} liveStream={liveStream} fallbackAsset={fallbackAsset} capturedFrameUrl={capturedFrame} isRewinding={isRewinding} onCapturedFrame={(frame) => { frameRef.current = frame; setCapturedFrame(frame); }} onNavigation={(input: WorldModelNavigationInput) => { void adapter.setNavigation(input); }} />
        {graph && world && currentNode && <SimulationHUD title={currentNode.title} immediatePriority={currentNode.immediatePriority} hazardLevels={world.hazardLevels} status={phase === "transfer" ? "transfer" : world.status} nodeIndex={nodeIndex} nodeCount={nodeList.length} />}
        {isRewinding && <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-amber-950/40 backdrop-blur-sm"><span className="rounded-full border border-amber-300/40 bg-black/70 px-5 py-2 text-xs font-mono uppercase tracking-[0.22em] text-amber-200">Restoring checkpoint</span></div>}
        {currentNode && world?.status === "debrief" && (
          <div className="absolute inset-x-4 bottom-4 z-30 mx-auto max-w-2xl rounded-2xl border border-purple-300/25 bg-neutral-950/90 p-5 shadow-2xl backdrop-blur-xl md:inset-x-auto md:left-1/2 md:w-[min(92%,620px)] md:-translate-x-1/2">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-purple-300">Debrief checkpoint</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Name what changed after your action.</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-300">{graph?.debrief.warningCue} {graph?.debrief.principle}</p>
            <p className="mt-2 text-sm text-amber-200">Recommended principle: {graph?.debrief.recommendedAction}</p>
            <button type="button" disabled={pending} onClick={() => phase === "primary" ? void continueToTransfer() : finishSession()} className="mt-4 w-full rounded-xl bg-purple-300 px-4 py-3 text-sm font-bold text-neutral-950 hover:bg-purple-200 disabled:opacity-50">{phase === "primary" ? "Try the transfer scenario" : "Complete readiness assessment"}</button>
          </div>
        )}
        {currentNode && world?.status === "active" && (
          <div className="absolute inset-x-4 bottom-4 z-30 mx-auto max-w-3xl space-y-3 md:inset-x-auto md:left-1/2 md:w-[min(92%,760px)] md:-translate-x-1/2">
            <div className="flex items-end justify-between gap-3"><InteractionPrompt interaction={activeInteractions[0] ?? null} disabled={pending} onActivate={(intent) => void submitIntent(intent)} /><HintPanel hints={activeHints} usedHintIds={usedHintIds} disabled={pending} onRequest={(hint) => handleHint(hint.id)} /></div>
            <ActionWheel interactions={activeInteractions} disabled={pending} onSelect={(intent) => void submitIntent(intent)} />
            <CommandBar node={currentNode} disabled={pending} onIntent={(intent) => void submitIntent(intent)} />
            <div className="flex items-end justify-between gap-3"><AvailableResources resources={world.availableResources} /><ScenarioTimeline events={simulation.eventLog} /></div>
          </div>
        )}
      </section>
    </main>
  );
}
