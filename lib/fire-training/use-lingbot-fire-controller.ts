"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckpointDirector } from "../lingbot/checkpoint-director";
import { LingBotSession } from "../lingbot/session";
import { MockLingBotSession } from "../lingbot/mock-session";
import { shouldUseMock } from "../lingbot/session-factory";
import type { LingBotFileRef, LingBotNavigationInput, LingBotSessionPort } from "../lingbot/types";
import { FIRE_INITIAL_SCENE, FIRE_RECOVERY_SCENE, sceneForFireAction } from "./lingbot-scenes";
import type { FireAction } from "./actions";
import { availableFireActions } from "./reducer";
import { createFireRuntime, fireRuntimeReducer, type FireRuntime, type LingBotRenderReceipt } from "./runtime";

export type LingBotFireController = {
  runtime: FireRuntime;
  stream: MediaStream | null;
  transitionFrame: string | null;
  transitionLabel: string | null;
  startupError: string | null;
  startupStage: "idle" | "connecting" | "uploading" | "rendering";
  startupElapsedSeconds: number;
  operationStatus: string | null;
  branchLatencyMs: number | null;
  start(): Promise<void>;
  submit(action: FireAction): Promise<void>;
  retryBranch(): Promise<void>;
  startAlternative(): Promise<void>;
  showDebrief(): void;
  replay(): Promise<void>;
  setCapture(capture: (() => string) | null): void;
  setNavigation(input: LingBotNavigationInput): void;
  dispose(): Promise<void>;
};

export function useLingBotFireController(providedSession?: LingBotSessionPort): LingBotFireController {
  const sessionRef = useRef<LingBotSessionPort | null>(providedSession ?? null);
  if (!sessionRef.current) sessionRef.current = new LingBotSession();
  const [, refreshSession] = useState(0);
  const directorRef = useRef<CheckpointDirector | null>(null);
  if (!directorRef.current) directorRef.current = new CheckpointDirector(sessionRef.current);
  useEffect(() => {
    if (providedSession && sessionRef.current !== providedSession) {
      sessionRef.current = providedSession;
      directorRef.current = new CheckpointDirector(providedSession);
      refreshSession((value) => value + 1);
    }
  }, [providedSession]);
  const runtimeRef = useRef(createFireRuntime());
  const [runtime, setRuntime] = useState(runtimeRef.current);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [transitionFrame, setTransitionFrame] = useState<string | null>(null);
  const [transitionLabel, setTransitionLabel] = useState<string | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [startupStage, setStartupStage] = useState<"idle" | "connecting" | "uploading" | "rendering">("idle");
  const [startupElapsedSeconds, setStartupElapsedSeconds] = useState(0);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const [branchLatencyMs, setBranchLatencyMs] = useState<number | null>(null);
  const startupPromiseRef = useRef<Promise<void> | null>(null);
  const replayPromiseRef = useRef<Promise<void> | null>(null);
  const startupStartedAtRef = useRef<number | null>(null);
  const initialReferenceRef = useRef<LingBotFileRef | null>(null);
  const captureRef = useRef<(() => string) | null>(null);
  const decisionCheckpointRef = useRef<Awaited<ReturnType<CheckpointDirector["prepareCheckpoint"]>> | null>(null);
  const recoveryCheckpointRef = useRef<Awaited<ReturnType<CheckpointDirector["prepareCheckpoint"]>> | null>(null);
  const lastBranchRef = useRef<FireAction | null>(null);
  const lastBranchKindRef = useRef<"branch" | "alternative">("branch");

  useEffect(() => {
    if (startupStage === "idle") {
      startupStartedAtRef.current = null;
      setStartupElapsedSeconds(0);
      return;
    }
    if (startupStartedAtRef.current === null) startupStartedAtRef.current = Date.now();
    const update = () => setStartupElapsedSeconds(Math.floor((Date.now() - startupStartedAtRef.current!) / 1000));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startupStage]);

  const apply = useCallback((event: Parameters<typeof fireRuntimeReducer>[1]) => {
    const next = fireRuntimeReducer(runtimeRef.current, event);
    runtimeRef.current = next;
    setRuntime(next);
    return next;
  }, []);

  const setCapture = useCallback((capture: (() => string) | null) => { captureRef.current = capture; }, []);
  const setNavigation = useCallback((input: LingBotNavigationInput) => { void sessionRef.current?.setNavigation(input).catch(() => undefined); }, []);

  const start = useCallback((): Promise<void> => {
    if (startupPromiseRef.current) return startupPromiseRef.current;
    if (runtimeRef.current.phase !== "booting" && runtimeRef.current.phase !== "fatal") return Promise.resolve();
    if (runtimeRef.current.phase === "fatal") {
      runtimeRef.current = createFireRuntime();
      setRuntime(runtimeRef.current);
    }
    setStartupError(null);
    setStartupStage("connecting");
    const pending = (async () => {
      try {
        const activeSession = typeof window !== "undefined" && shouldUseMock(window.location.search, process.env.NODE_ENV)
          ? new MockLingBotSession()
          : sessionRef.current!;
        if (activeSession !== sessionRef.current) {
          sessionRef.current = activeSession;
          directorRef.current = new CheckpointDirector(activeSession);
        }
        await activeSession.connect();
        setStartupStage("uploading");
        const response = await fetch("/references/bedroom-fire-v2.png");
        const reference = await activeSession.uploadReference(await response.blob());
        initialReferenceRef.current = reference;
        setStartupStage("rendering");
        const receipt = await activeSession.render({ jobId: 0, kind: "initial", checkpoint: null, scene: FIRE_INITIAL_SCENE }, reference);
        if (!receipt || activeSession.getStream() === null) throw new Error("LingBot did not publish a live video stream.");
        setStream(activeSession.getStream());
        setStartupStage("idle");
        apply({ type: "LIVE_READY" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "LingBot could not start.";
        setStartupStage("idle");
        setStartupError(message);
        apply({ type: "FAIL", message });
      }
    })();
    startupPromiseRef.current = pending;
    void pending.then(
      () => { if (startupPromiseRef.current === pending) startupPromiseRef.current = null; },
      () => { if (startupPromiseRef.current === pending) startupPromiseRef.current = null; },
    );
    return pending;
  }, [apply]);

  const renderAction = useCallback(async (action: FireAction, options?: { kind?: "branch" | "alternative"; jobId?: number; alreadyRequested?: boolean }): Promise<void> => {
    const director = directorRef.current!;
    const kind = options?.kind ?? "branch";
    const jobId = options?.jobId ?? director.peekNextJobId();
    if (!options?.alreadyRequested) {
      apply(kind === "alternative" ? { type: "ALTERNATIVE_REQUESTED", jobId, action } : { type: "BRANCH_REQUESTED", jobId, action });
    }
    const requestedAt = Date.now();
    setOperationStatus(kind === "alternative" ? "Rendering the alternative choice…" : action === "CloseDoor" ? "Rendering recovery…" : "Rendering consequence…");
    try {
      let receipt: LingBotRenderReceipt;
      const activeSession = sessionRef.current!;
      if (action === "CrouchLow") {
        receipt = await activeSession.applyDelta({ jobId, prompt: "The learner crouches low beneath the existing smoke layer. Keep the same room and door state.", cameraPose: [], attentionWindow: "small" });
      } else {
        const checkpoint = action === "CloseDoor" ? recoveryCheckpointRef.current : decisionCheckpointRef.current;
        if (!checkpoint) throw new Error("The live checkpoint is not ready.");
        const scene = sceneForFireAction(action);
        setTransitionFrame(checkpoint.frameDataUrl);
        setTransitionLabel(kind === "alternative" ? "Rendering the alternative" : action === "CloseDoor" ? "Rendering recovery" : "Rendering consequence");
        receipt = await director.renderBranch({ kind, checkpoint, scene });
        if (scene.settledPrompt) {
          await activeSession.applyDelta({
            jobId,
            prompt: `${scene.invariantPrompt} ${scene.settledPrompt}`,
            cameraPose: scene.cameraPose,
            attentionWindow: scene.attentionWindow,
          });
        }
      }
      setStream(activeSession.getStream());
      setBranchLatencyMs(receipt.firstFrameAt - requestedAt);
      apply(kind === "alternative" ? { type: "ALTERNATIVE_RENDERED", receipt } : { type: "BRANCH_RENDERED", receipt });
      lastBranchRef.current = null;
    } catch (error) {
      apply({ type: "BRANCH_FAILED", jobId, message: error instanceof Error ? error.message : "LingBot branch render failed." });
      lastBranchRef.current = action;
      lastBranchKindRef.current = kind;
    } finally {
      setTransitionFrame(null);
      setTransitionLabel(null);
      setOperationStatus(null);
    }
  }, [apply]);

  const submit = useCallback(async (action: FireAction) => {
    const current = runtimeRef.current;
    if (current.pendingAction || !availableFireActions(current.training).includes(action)) return;
    if (current.training.stage === "decision" && current.phase === "decision_ready") {
      lastBranchRef.current = action;
      lastBranchKindRef.current = "branch";
      await renderAction(action);
      return;
    }
    if (current.training.stage === "counterfactual-decision" && current.phase === "alternative") {
      lastBranchRef.current = action;
      lastBranchKindRef.current = "alternative";
      await renderAction(action, { kind: "alternative" });
      return;
    }
    if (action === "CloseDoor" && current.training.stage === "secure-door") {
      const jobId = directorRef.current!.peekNextJobId();
      const requested = apply({ type: "BRANCH_REQUESTED", jobId, action });
      if (!requested.pendingAction) return;
      lastBranchRef.current = action;
      lastBranchKindRef.current = "branch";
      setOperationStatus("Preparing recovery checkpoint…");
      try {
        if (!captureRef.current) throw new Error("The live video frame is not ready for the recovery checkpoint.");
        recoveryCheckpointRef.current = await directorRef.current!.prepareCheckpoint({ id: "fire:recovery", capture: captureRef.current, seed: FIRE_RECOVERY_SCENE.seed, worldState: current.training });
        await renderAction(action, { jobId, alreadyRequested: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The recovery checkpoint could not be prepared.";
        apply({ type: "BRANCH_FAILED", jobId, message });
        setOperationStatus(null);
      }
      return;
    }
    if (action === "CrouchLow" && current.training.stage === "consequence") {
      lastBranchRef.current = action;
      await renderAction(action);
      return;
    }
    const next = apply({ type: "LOCAL_ACTION", action });
    if (action === "FeelDoor" && next.phase === "checkpointing") {
      setOperationStatus("Preparing decision checkpoint…");
      try {
        if (!captureRef.current) throw new Error("The live video frame is not ready for the decision checkpoint.");
        decisionCheckpointRef.current = await directorRef.current!.prepareCheckpoint({ id: "fire:decision", capture: captureRef.current, seed: sceneForFireAction("OpenDoor").seed, worldState: next.training });
        setTransitionFrame(decisionCheckpointRef.current.frameDataUrl);
        apply({ type: "CHECKPOINT_READY", checkpointId: decisionCheckpointRef.current.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The decision checkpoint could not be prepared.";
        setStartupError(message);
        apply({ type: "FAIL", message });
      } finally {
        setTransitionFrame(null);
        setOperationStatus(null);
      }
    }
  }, [apply, renderAction]);

  const retryBranch = useCallback(async () => {
    if (lastBranchRef.current) await submit(lastBranchRef.current);
  }, [submit]);

  const startAlternative = useCallback(async () => {
    const current = runtimeRef.current;
    const checkpoint = decisionCheckpointRef.current;
    if (!checkpoint || current.phase !== "consequence") return;
    const restored = apply({ type: "START_ALTERNATIVE" });
    if (restored.phase !== "alternative") return;
    setTransitionFrame(checkpoint.frameDataUrl);
    setTransitionLabel("Decision restored — choose the alternative");
    setOperationStatus("The decision is restored. Choose the alternative action.");
  }, [apply]);

  const showDebrief = useCallback(() => {
    apply({ type: "DEBRIEF_READY" });
    setOperationStatus(null);
  }, [apply]);

  const replay = useCallback((): Promise<void> => {
    if (replayPromiseRef.current) return replayPromiseRef.current;
    const activeSession = sessionRef.current!;
    const reference = initialReferenceRef.current;
    if (!reference) {
      runtimeRef.current = createFireRuntime();
      setRuntime(runtimeRef.current);
      return Promise.resolve();
    }
    runtimeRef.current = createFireRuntime();
    setRuntime(runtimeRef.current);
    directorRef.current = new CheckpointDirector(activeSession);
    decisionCheckpointRef.current = null;
    recoveryCheckpointRef.current = null;
    lastBranchRef.current = null;
    setStartupError(null);
    setOperationStatus("Rendering the opening scene…");
    setStartupStage("rendering");
    const pending = (async () => {
      try {
        const receipt = await activeSession.render({ jobId: 0, kind: "initial", checkpoint: null, scene: FIRE_INITIAL_SCENE }, reference);
        if (!receipt || activeSession.getStream() === null) throw new Error("LingBot did not publish a live video stream.");
        setStream(activeSession.getStream());
        setStartupStage("idle");
        setOperationStatus(null);
        apply({ type: "LIVE_READY" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The scenario could not be replayed.";
        setStartupStage("idle");
        setOperationStatus(null);
        setStartupError(message);
        apply({ type: "FAIL", message });
      }
    })();
    replayPromiseRef.current = pending;
    void pending.then(
      () => { if (replayPromiseRef.current === pending) replayPromiseRef.current = null; },
      () => { if (replayPromiseRef.current === pending) replayPromiseRef.current = null; },
    );
    return pending;
  }, [apply]);

  const dispose = useCallback(async () => {
    directorRef.current?.cancel();
    await sessionRef.current?.stopNavigation().catch(() => undefined);
    await sessionRef.current?.disconnect().catch(() => undefined);
    setStream(null);
  }, []);

  return { runtime, stream, transitionFrame, transitionLabel, startupError, startupStage, startupElapsedSeconds, operationStatus, branchLatencyMs, start, submit, retryBranch, startAlternative, showDebrief, replay, setCapture, setNavigation, dispose };
}
