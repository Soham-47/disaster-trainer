"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { GenerationStatus } from "@/components/GenerationStatus";
import { WorldViewport } from "@/components/WorldViewport";
import { Debrief } from "@/components/Debrief";
import { DecisionOverlay } from "@/components/DecisionOverlay";
import { EntryScreen } from "@/components/EntryScreen";
import { ResultView } from "@/components/ResultView";
import { RewindTransition } from "@/components/RewindTransition";
import { TransferCheck } from "@/components/TransferCheck";
import { demoScenario } from "@/lib/player/demo-scenario";
import { initialPlayerState, playerReducer } from "@/lib/player/state-machine";
import { reactorClient, type WorldModelAdapter } from "@/lib/reactor/client";
import type { WorldModelStatus } from "@/lib/reactor/events";
import type { ChoiceDefinition, GeneratedScenario } from "@/lib/scenario/types";
import type { SessionResult } from "@/lib/scenario/types";
import { scoreSession } from "@/lib/scenario/scoring";
import { buildWorldModelPrompt, normalizeScenarioBrief } from "@/lib/scenario/prompt";
import { playAlternative as playAlternativeBranch, playConsequence } from "@/lib/player/world-actions";

type ExperiencePlayerProps = {
  scenario?: GeneratedScenario;
  transferScenario?: GeneratedScenario;
  adapter?: WorldModelAdapter;
};

type VisualBranch = "orient" | "safe" | "unsafe";

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

export function ExperiencePlayer({
  scenario = demoScenario,
  transferScenario = demoScenario,
  adapter = reactorClient,
}: ExperiencePlayerProps) {
  const [player, dispatch] = useReducer(playerReducer, initialPlayerState);
  const [status, setStatus] = useState<WorldModelStatus>(
    (adapter as WorldModelAdapter & { getStatus?: () => WorldModelStatus }).getStatus?.() ?? "idle"
  );
  const [mode, setMode] = useState<"live" | "fallback">(modeOf(adapter));
  const [fallbackReason, setFallbackReason] = useState<string | null>(fallbackReasonOf(adapter));
  const [activeAsset, setActiveAsset] = useState(scenario.orientFallbackAsset);
  const [ambientPrompt, setAmbientPrompt] = useState(scenario.basePrompt);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [scenarioBrief, setScenarioBrief] = useState("");
  const [visualBranch, setVisualBranch] = useState<VisualBranch>("orient");
  const [pending, setPending] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [alternativeStarted, setAlternativeStarted] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const unsubscribe = adapter.onStatus((nextStatus) => {
      setStatus(nextStatus);
      setMode(modeOf(adapter));
      setActiveAsset(fallbackAssetOf(adapter, activeAsset));
      setFallbackReason(fallbackReasonOf(adapter));
    });
    return unsubscribe;
  }, [adapter, activeAsset]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  const streamFrame = useCallback((frame: unknown) => {
    const liveFrame = frame as { stream?: MediaStream; track?: MediaStreamTrack } | null;
    const nextStream = liveFrame?.stream ?? (
      liveFrame?.track && typeof MediaStream !== "undefined"
        ? new MediaStream([liveFrame.track])
        : null
    );

    setLiveStream((previousStream) => {
      if (previousStream === nextStream) return previousStream;
      previousStream?.getTracks().forEach((track) => track.stop());
      return nextStream;
    });
  }, []);

  useEffect(() => () => {
    streamFrame(null);
    void adapter.reset();
  }, [adapter, streamFrame]);

  const startAdapter = useCallback(async (nextScenario: GeneratedScenario, brief: string) => {
    const worldPrompt = buildWorldModelPrompt(nextScenario.basePrompt, brief);
    setAmbientPrompt(worldPrompt);
    setVisualBranch("orient");
    setCapturedFrame(null);
    setAlternativeStarted(false);
    const orientFallback = nextScenario.orientFallbackAsset;
    setActiveAsset(orientFallback);
    await adapter.start({
      referenceImage: nextScenario.referenceImage,
      prompt: worldPrompt,
      seed: nextScenario.reactorSeed,
      fallbackAsset: orientFallback,
      onFrame: streamFrame,
    });
    if (modeOf(adapter) !== "live") {
      throw new Error("Live LingBot startup did not become ready");
    }
    setStatus((adapter as WorldModelAdapter & { getStatus?: () => WorldModelStatus }).getStatus?.() ?? "generating");
    setMode(modeOf(adapter));
  }, [adapter, streamFrame]);

  const startScenario = async (brief: string) => {
    const normalizedBrief = normalizeScenarioBrief(brief);
    setScenarioBrief(normalizedBrief);
    setStartupError(null);
    setSessionResult(null);
    setPending(true);
    try {
      await startAdapter(scenario, normalizedBrief);
      dispatch({ type: "START_SCENARIO", scenarioId: scenario.id });
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : "Unable to connect to LingBot");
    } finally {
      setPending(false);
    }
  };

  const selectInitialChoice = async (choice: ChoiceDefinition) => {
    if (pending || player.current !== "decision") return;
    setPending(true);
    dispatch({ type: "SELECT_CHOICE", choiceId: choice.id });
    const consequence = scenario.consequences[choice.consequenceStateId];
    const consequencePrompt = buildWorldModelPrompt(consequence.prompt, scenarioBrief);
    setVisualBranch(choice.safetyClass === "unsafe" ? "unsafe" : "safe");
    setAmbientPrompt(consequencePrompt);
    setActiveAsset(consequence.fallbackAsset);
    try {
      await playConsequence(adapter, consequencePrompt);
    } catch (error) {
      dispatch({ type: "FAIL", error: error instanceof Error ? error.message : "Unable to play consequence" });
    } finally {
      setPending(false);
    }
  };

  const finishConsequence = async () => {
    if (pending || !player.initialChoiceId) return;
    setPending(true);
    try {
      await adapter.pause();
      dispatch({ type: "CONSEQUENCE_COMPLETE" });
    } catch (error) {
      dispatch({ type: "FAIL", error: error instanceof Error ? error.message : "Unable to rewind" });
    } finally {
      setPending(false);
    }
  };

  const finishRewind = useCallback(() => {
    dispatch({ type: "REWIND_COMPLETE" });
  }, []);

  const alternativeChoice = useMemo(() => {
    return scenario.decision.choices.find((choice) => choice.id !== player.initialChoiceId) ?? scenario.decision.choices[0];
  }, [player.initialChoiceId, scenario.decision.choices]);

  const playAlternative = async () => {
    if (pending || !alternativeChoice) return;
    setPending(true);
    const consequence = scenario.consequences[alternativeChoice.consequenceStateId];
    const consequencePrompt = buildWorldModelPrompt(consequence.prompt, scenarioBrief);
    setVisualBranch(alternativeChoice.safetyClass === "unsafe" ? "unsafe" : "safe");
    setAmbientPrompt(consequencePrompt);
    setActiveAsset(consequence.fallbackAsset);
    try {
      await playAlternativeBranch(adapter, consequencePrompt);
      setAlternativeStarted(true);
    } catch (error) {
      dispatch({ type: "FAIL", error: error instanceof Error ? error.message : "Unable to play counterfactual" });
    } finally {
      setPending(false);
    }
  };

  const startTransfer = async () => {
    setPending(true);
    try {
      await startAdapter(transferScenario, scenarioBrief);
      dispatch({ type: "DEBRIEF_NEXT" });
    } catch (error) {
      dispatch({ type: "FAIL", error: error instanceof Error ? error.message : "Unable to start transfer" });
    } finally {
      setPending(false);
    }
  };

  const submitTransfer = async (choice: ChoiceDefinition) => {
    if (pending || player.current !== "transfer") return;
    setPending(true);
    dispatch({ type: "SUBMIT_TRANSFER", choiceId: choice.id });
    const initialChoice = scenario.decision.choices.find((candidate) => candidate.id === player.initialChoiceId);
    if (initialChoice && player.startedAt) {
      setSessionResult(scoreSession({
        sessionId: `${scenario.id}-${player.startedAt}`,
        scenarioId: scenario.id,
        initialChoice,
        transferChoice: choice,
        generationMode: modeOf(adapter),
        generationValidated: modeOf(adapter) === "live",
        startedAt: new Date(player.startedAt).toISOString(),
        completedAt: new Date().toISOString(),
      }));
    }
    try {
      await adapter.pause();
    } finally {
      setPending(false);
    }
  };

  const restart = async () => {
    setPending(true);
    await adapter.reset();
    dispatch({ type: "RESTART" });
    setSessionResult(null);
    setStatus("idle");
    setMode("live");
    setFallbackReason(null);
    setStartupError(null);
    setVisualBranch("orient");
    streamFrame(null);
    setCapturedFrame(null);
    setAmbientPrompt(scenario.basePrompt);
    setScenarioBrief("");
    setPending(false);
  };

  const initialChoice = scenario.decision.choices.find((choice) => choice.id === player.initialChoiceId);
  const transferChoice = transferScenario.decision.choices.find((choice) => choice.id === player.transferChoiceId);
  const statePanel = (() => {
    switch (player.current) {
      case "entry":
        return <EntryScreen onStart={(brief) => void startScenario(brief)} disabled={pending} errorMessage={startupError} />;
      case "orient":
        return (
          <section className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5 shadow-2xl">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-amber-300">Orient</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Notice what the environment is telling you.</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-300">{scenario.cues.map((cue) => cue.learnerCopy).join(" ")}</p>
            <button type="button" disabled={pending} onClick={() => dispatch({ type: "ORIENT_COMPLETE" })} className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50">Continue to the decision</button>
          </section>
        );
      case "decision":
        return <DecisionOverlay decision={scenario.decision} onSelect={(choice) => void selectInitialChoice(choice)} disabled={pending} />;
      case "consequence":
        return (
          <section className="rounded-2xl border border-rose-400/30 bg-neutral-950/95 p-5 shadow-2xl">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-rose-300">Your choice</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Experience the consequence.</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-300">The scene is following: {initialChoice?.label}</p>
            <button type="button" disabled={pending} onClick={() => void finishConsequence()} className="mt-5 w-full rounded-xl bg-rose-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50">Rewind to the decision</button>
          </section>
        );
      case "rewind":
        return <RewindTransition reducedMotion={reducedMotion} onComplete={finishRewind} />;
      case "alternative":
        return (
          <section className="rounded-2xl border border-purple-400/30 bg-neutral-950/95 p-5 shadow-2xl">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-purple-300">Counterfactual</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Now experience the other future.</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-300">{alternativeChoice?.label}</p>
            {!alternativeStarted ? (
              <button type="button" disabled={pending} onClick={() => void playAlternative()} className="mt-5 w-full rounded-xl bg-purple-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-50">Play counterfactual</button>
            ) : (
              <button type="button" disabled={pending} onClick={() => dispatch({ type: "ALTERNATIVE_COMPLETE" })} className="mt-5 w-full rounded-xl bg-purple-400 px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-50">Continue to the debrief</button>
            )}
          </section>
        );
      case "debrief":
        return <Debrief scenario={scenario} onContinue={() => void startTransfer()} />;
      case "transfer":
        return <TransferCheck scenario={transferScenario} onSelect={(choice) => void submitTransfer(choice)} disabled={pending} />;
      case "result":
        return <ResultView initialChoiceLabel={initialChoice?.label ?? "Not recorded"} transferChoiceLabel={transferChoice?.label ?? "Not recorded"} generationMode={mode} sessionResult={sessionResult} onRestart={() => void restart()} />;
      case "error":
        return (
          <section role="alert" className="rounded-2xl border border-rose-400/40 bg-rose-950/90 p-6 shadow-2xl">
            <p className="text-xs font-mono uppercase tracking-[0.24em] text-rose-200">Experience unavailable</p>
            <h2 className="mt-2 text-xl font-semibold text-white">The prepared continuation could not start.</h2>
            <p className="mt-3 text-sm text-rose-100/80">{player.errorMessage}</p>
            <button type="button" onClick={() => void restart()} className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-bold text-neutral-950">Return to start</button>
          </section>
        );
    }
  })();

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-6 text-neutral-100 md:px-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300">Counterfactual Disaster Trainer</p>
          <p className="mt-1 text-sm text-neutral-400">Open-ended situations · constrained decisions · controlled safety truth</p>
        </div>
        <GenerationStatus
          status={status}
          mode={mode}
          modelName="LingBot World 2"
          fallbackReason={mode === "fallback" ? fallbackReason ?? "Prepared continuation" : null}
        />
      </header>

      {player.current === "entry" ? (
        <div className="mx-auto mt-10 max-w-7xl">{statePanel}</div>
      ) : (
        <section className="mx-auto mt-6 grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)] lg:items-start">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <WorldViewport
              status={status}
              fallbackAsset={activeAsset}
              mode={mode}
              capturedFrameUrl={capturedFrame}
              isRewinding={player.current === "rewind"}
              ambientPrompt={ambientPrompt}
              visualBranch={visualBranch}
              liveStream={liveStream}
              onCapturedFrame={setCapturedFrame}
            />
          </div>
          <aside>{statePanel}</aside>
        </section>
      )}

      <footer className="mx-auto mt-8 flex max-w-7xl flex-wrap justify-between gap-3 border-t border-neutral-800 pt-4 text-xs text-neutral-500">
        <span>Experimental preparedness-practice prototype</span>
        <span>Fallback runs are not scored</span>
      </footer>
    </main>
  );
}

