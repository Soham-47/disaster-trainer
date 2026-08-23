"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckpointDirector } from "../lingbot/checkpoint-director";
import { LingBotSession } from "../lingbot/session";
import { MockLingBotSession } from "../lingbot/mock-session";
import { shouldUseMock } from "../lingbot/session-factory";
import type { LingBotNavigationInput, LingBotSessionPort } from "../lingbot/types";
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
  branchLatencyMs: number | null;
  start(): Promise<void>;
  submit(action: FireAction): Promise<void>;
  retryBranch(): Promise<void>;
  startAlternative(): Promise<void>;
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
  const session = sessionRef.current;
  const runtimeRef = useRef(createFireRuntime());
  const [runtime, setRuntime] = useState(runtimeRef.current);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [transitionFrame, setTransitionFrame] = useState<string | null>(null);
  const [transitionLabel, setTransitionLabel] = useState<string | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [branchLatencyMs, setBranchLatencyMs] = useState<number | null>(null);
  const captureRef = useRef<(() => string) | null>(null);
  const decisionCheckpointRef = useRef<Awaited<ReturnType<CheckpointDirector["prepareCheckpoint"]>> | null>(null);
  const recoveryCheckpointRef = useRef<Awaited<ReturnType<CheckpointDirector["prepareCheckpoint"]>> | null>(null);
  const lastBranchRef = useRef<FireAction | null>(null);

  const apply = useCallback((event: Parameters<typeof fireRuntimeReducer>[1]) => {
    const next = fireRuntimeReducer(runtimeRef.current, event);
    runtimeRef.current = next;
    setRuntime(next);
    return next;
  }, []);

  const setCapture = useCallback((capture: (() => string) | null) => { captureRef.current = capture; }, []);
  const setNavigation = useCallback((input: LingBotNavigationInput) => { void session.setNavigation(input).catch(() => undefined); }, [session]);

  const start = useCallback(async () => {
    if (runtimeRef.current.phase !== "booting" && runtimeRef.current.phase !== "fatal") return;
    if (runtimeRef.current.phase === "fatal") {
      runtimeRef.current = createFireRuntime();
      setRuntime(runtimeRef.current);
    }
    setStartupError(null);
    try {
      const activeSession = typeof window !== "undefined" && shouldUseMock(window.location.search, process.env.NODE_ENV)
        ? new MockLingBotSession()
        : session;
      if (activeSession !== sessionRef.current) {
        sessionRef.current = activeSession;
        directorRef.current = new CheckpointDirector(activeSession);
      }
      await activeSession.connect();
      const response = await fetch("/references/bedroom-fire-v2.png");
      const reference = await activeSession.uploadReference(await response.blob());
      const receipt = await activeSession.render({ jobId: 0, kind: "initial", checkpoint: null, scene: FIRE_INITIAL_SCENE }, reference);
      if (!receipt || activeSession.getStream() === null) throw new Error("LingBot did not publish a live video stream.");
      setStream(activeSession.getStream());
      apply({ type: "LIVE_READY" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "LingBot could not start.";
      setStartupError(message);
      apply({ type: "FAIL", message });
    }
  }, [apply, session]);

  const renderAction = useCallback(async (action: FireAction): Promise<void> => {
    const director = directorRef.current!;
    const jobId = director.peekNextJobId();
    apply({ type: "BRANCH_REQUESTED", jobId, action });
    const requestedAt = Date.now();
    try {
      let receipt: LingBotRenderReceipt;
      if (action === "CrouchLow") {
        receipt = await session.applyDelta({ jobId, prompt: "The learner crouches low beneath the existing smoke layer. Keep the same room and door state.", cameraPose: [], attentionWindow: "small" });
      } else {
        const checkpoint = action === "CloseDoor" ? recoveryCheckpointRef.current : decisionCheckpointRef.current;
        if (!checkpoint) throw new Error("The live checkpoint is not ready.");
        setTransitionFrame(checkpoint.frameDataUrl);
        setTransitionLabel(action === "CloseDoor" ? "Rendering recovery" : "Rendering consequence");
        receipt = await director.renderBranch({ kind: "branch", checkpoint, scene: sceneForFireAction(action) });
      }
      setStream(session.getStream());
      setBranchLatencyMs(receipt.firstFrameAt - requestedAt);
      apply({ type: "BRANCH_RENDERED", receipt });
      lastBranchRef.current = null;
    } catch (error) {
      apply({ type: "BRANCH_FAILED", jobId, message: error instanceof Error ? error.message : "LingBot branch render failed." });
      lastBranchRef.current = action;
    } finally {
      setTransitionFrame(null);
      setTransitionLabel(null);
    }
  }, [apply, session]);

  const submit = useCallback(async (action: FireAction) => {
    const current = runtimeRef.current;
    if (current.pendingAction || !availableFireActions(current.training).includes(action)) return;
    if (current.training.stage === "decision" && current.phase === "decision_ready") {
      lastBranchRef.current = action;
      await renderAction(action);
      return;
    }
    if (action === "CloseDoor" && current.training.stage === "secure-door") {
      if (!captureRef.current) return;
      recoveryCheckpointRef.current = await directorRef.current!.prepareCheckpoint({ id: "fire:recovery", capture: captureRef.current, seed: FIRE_RECOVERY_SCENE.seed, worldState: current.training });
      await renderAction(action);
      return;
    }
    if (action === "CrouchLow" && current.training.stage === "consequence") {
      lastBranchRef.current = action;
      await renderAction(action);
      return;
    }
    const next = apply({ type: "LOCAL_ACTION", action });
    if (action === "FeelDoor" && next.phase === "checkpointing" && captureRef.current) {
      try {
        decisionCheckpointRef.current = await directorRef.current!.prepareCheckpoint({ id: "fire:decision", capture: captureRef.current, seed: sceneForFireAction("OpenDoor").seed, worldState: next.training });
        setTransitionFrame(decisionCheckpointRef.current.frameDataUrl);
        apply({ type: "CHECKPOINT_READY", checkpointId: decisionCheckpointRef.current.id });
      } catch (error) {
        apply({ type: "FAIL", message: error instanceof Error ? error.message : "The decision checkpoint could not be prepared." });
      } finally {
        setTransitionFrame(null);
      }
    }
  }, [apply, renderAction]);

  const retryBranch = useCallback(async () => {
    if (lastBranchRef.current) await renderAction(lastBranchRef.current);
  }, [renderAction]);

  const startAlternative = useCallback(async () => {
    const current = runtimeRef.current;
    const checkpoint = decisionCheckpointRef.current;
    if (!checkpoint || current.phase !== "consequence") return;
    const action: FireAction = current.training.initialDecision === "OpenDoor" ? "KeepDoorClosed" : "OpenDoor";
    const jobId = directorRef.current!.peekNextJobId();
    apply({ type: "ALTERNATIVE_REQUESTED", jobId, action });
    setTransitionFrame(checkpoint.frameDataUrl);
    setTransitionLabel("Rewinding same checkpoint");
    try {
      const receipt = await directorRef.current!.renderBranch({ kind: "alternative", checkpoint, scene: sceneForFireAction(action) });
      setStream(session.getStream());
      apply({ type: "ALTERNATIVE_RENDERED", receipt });
      apply({ type: "DEBRIEF_READY" });
    } catch (error) {
      apply({ type: "BRANCH_FAILED", jobId, message: error instanceof Error ? error.message : "The alternative could not render." });
    } finally {
      setTransitionFrame(null);
      setTransitionLabel(null);
    }
  }, [apply, session]);

  const dispose = useCallback(async () => {
    directorRef.current?.cancel();
    await session.stopNavigation().catch(() => undefined);
    await session.disconnect().catch(() => undefined);
    setStream(null);
  }, [session]);

  return { runtime, stream, transitionFrame, transitionLabel, startupError, branchLatencyMs, start, submit, retryBranch, startAlternative, setCapture, setNavigation, dispose };
}
