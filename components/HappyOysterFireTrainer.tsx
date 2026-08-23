"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { directionFromKeys, lookFromMouseDelta, type AdventureDirection } from "@/lib/happy-oyster/controls";
import {
  HappyOysterFireClient,
  type FireWorldStatus,
  type ReviewedFireAction,
} from "@/lib/happy-oyster/fire-client";
import {
  FIRE_ACTION_LABELS,
  FIRE_STAGE_COPY,
  RED_CROSS_FIRE_GUIDANCE_URL,
} from "@/lib/fire-training/content";
import {
  availableFireActions,
  createFireTrainingState,
  fireTrainingReducer,
  scoreFireTraining,
} from "@/lib/fire-training/reducer";

type SessionResponse = { token: string; worldId: string } | { error: string; message: string };

const MODEL_ACTIONS = new Set<ReviewedFireAction>([
  "OpenDoor",
  "CrouchLow",
]);

function statusLabel(status: FireWorldStatus) {
  if (status === "live") return "LIVE WORLD";
  if (status === "restarting") return "REWINDING";
  if (status === "error") return "CONNECTION FAILED";
  if (status === "idle") return "READY";
  return "CONNECTING";
}

export function HappyOysterFireTrainer() {
  const [training, dispatch] = useReducer(fireTrainingReducer, undefined, createFireTrainingState);
  const [worldStatus, setWorldStatus] = useState<FireWorldStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [visualValid, setVisualValid] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HappyOysterFireClient | null>(null);
  const keysRef = useRef(new Set<string>());
  const directionRef = useRef<AdventureDirection | null>(null);
  const lookTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = FIRE_STAGE_COPY[training.stage];
  const actions = availableFireActions(training);
  const active = training.stage !== "briefing" && training.stage !== "error";
  const assessment = useMemo(
    () => scoreFireTraining(training, worldStatus === "live" && visualValid),
    [training, visualValid, worldStatus]
  );
  const displayedStatus: FireWorldStatus = training.stage === "error" ? "error" : worldStatus;

  const attachClient = useCallback(() => {
    if (clientRef.current) return clientRef.current;
    const client = new HappyOysterFireClient();
    client.onStatus(setWorldStatus);
    clientRef.current = client;
    return client;
  }, []);

  const stopControls = useCallback(() => {
    keysRef.current.clear();
    directionRef.current = null;
    if (lookTimerRef.current) clearTimeout(lookTimerRef.current);
    lookTimerRef.current = null;
    void clientRef.current?.stop().catch(() => undefined);
  }, []);

  useEffect(() => () => {
    stopControls();
    void clientRef.current?.disconnect();
  }, [stopControls]);

  const start = useCallback(async () => {
    if (!videoRef.current || busy) return;
    setBusy(true);
    setError(null);
    setVisualValid(true);
    try {
      const response = await fetch("/api/happy-oyster-session", { method: "POST" });
      const data = (await response.json()) as SessionResponse;
      if (!response.ok || !("token" in data)) throw new Error("message" in data ? data.message : "Session setup failed.");
      await attachClient().start({ token: data.token, worldId: data.worldId, videoElement: videoRef.current });
      dispatch({ type: "START" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The live world could not start.";
      setError(message);
      dispatch({ type: "FAIL", message });
    } finally {
      setBusy(false);
    }
  }, [attachClient, busy]);

  const performAction = useCallback(async (action: ReviewedFireAction) => {
    if (busy || !actions.includes(action) || worldStatus !== "live") return;
    setBusy(true);
    setError(null);
    setHintVisible(false);
    stopControls();
    try {
      if (action === "OpenDoor") await clientRef.current?.approachAndInteract(action);
      else if (MODEL_ACTIONS.has(action)) await clientRef.current?.interact(action);
      dispatch({ type: "SUBMIT_ACTION", action });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The live interaction failed.");
    } finally {
      setBusy(false);
    }
  }, [actions, busy, stopControls, worldStatus]);

  const replayAlternative = useCallback(async () => {
    if (training.stage !== "outcome" || busy) return;
    setBusy(true);
    setError(null);
    stopControls();
    dispatch({ type: "START_COUNTERFACTUAL" });
    try {
      await clientRef.current?.restartTravel();
      dispatch({ type: "RESTORE_COUNTERFACTUAL" });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The same world could not restart.";
      setError(message);
      dispatch({ type: "FAIL", message });
    } finally {
      setBusy(false);
    }
  }, [busy, stopControls, training.stage]);

  useEffect(() => {
    if (training.stage !== "counterfactual-consequence") return;
    const timeout = setTimeout(() => dispatch({ type: "ADVANCE_DEBRIEF" }), 5500);
    return () => clearTimeout(timeout);
  }, [training.stage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!active || worldStatus !== "live") return;
      const key = event.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        event.preventDefault();
        keysRef.current.add(key);
        const next = directionFromKeys(keysRef.current);
        if (next && next !== directionRef.current) {
          directionRef.current = next;
          void clientRef.current?.move(next);
        }
      }
      if (key === "e" && actions[0]) {
        event.preventDefault();
        void performAction(actions[0]);
      }
      const numbered = Number(key) - 1;
      if (numbered >= 0 && actions[numbered]) void performAction(actions[numbered]);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!["w", "a", "s", "d"].includes(key)) return;
      keysRef.current.delete(key);
      const next = directionFromKeys(keysRef.current);
      if (next === directionRef.current) return;
      directionRef.current = next;
      if (next) void clientRef.current?.move(next);
      else void clientRef.current?.releaseMovement();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", stopControls);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stopControls);
    };
  }, [actions, active, performAction, stopControls, worldStatus]);

  useEffect(() => {
    const onPointerLock = () => setPointerLocked(document.pointerLockElement === viewportRef.current);
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== viewportRef.current || worldStatus !== "live") return;
      const look = lookFromMouseDelta(event.movementX, event.movementY);
      if (!look) return;
      void clientRef.current?.look(look);
      if (lookTimerRef.current) clearTimeout(lookTimerRef.current);
      lookTimerRef.current = setTimeout(() => void clientRef.current?.releaseLook(), 90);
    };
    document.addEventListener("pointerlockchange", onPointerLock);
    document.addEventListener("mousemove", onMouseMove);
    return () => {
      document.removeEventListener("pointerlockchange", onPointerLock);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [worldStatus]);

  const retry = () => {
    dispatch({ type: "RESTART" });
    void start();
  };

  return (
    <main className="relative h-[100dvh] min-h-[680px] overflow-hidden bg-[#050607] text-white">
      <div
        ref={viewportRef}
        className="absolute inset-0 cursor-crosshair bg-[#07090b]"
        onClick={() => active && viewportRef.current?.requestPointerLock()}
        aria-label="Live first-person apartment world"
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover transition-opacity duration-700 ${worldStatus === "live" ? "opacity-100" : "opacity-0"}`}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,0,0,.62)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5 md:p-8">
        <div className="max-w-xl">
          <p className="text-[10px] font-bold uppercase tracking-[.32em] text-orange-300">Apartment fire · Live training</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight md:text-3xl">{copy.priority}</h1>
          {active && <p className="mt-2 max-w-lg text-sm text-white/70">{copy.prompt}</p>}
        </div>
        <div className={`rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[.18em] backdrop-blur-md ${worldStatus === "live" ? "border-emerald-400/40 bg-emerald-950/55 text-emerald-200" : worldStatus === "error" ? "border-red-400/40 bg-red-950/60 text-red-200" : "border-white/15 bg-black/45 text-white/65"}`}>
          <span className={`mr-2 inline-block size-1.5 rounded-full ${worldStatus === "live" ? "animate-pulse bg-emerald-400" : "bg-white/40"}`} />
          {statusLabel(displayedStatus)}
        </div>
      </header>

      {active && training.stage !== "debrief" && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="relative size-6 opacity-70 before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:bg-white/80 after:absolute after:left-0 after:top-1/2 after:h-px after:w-full after:bg-white/80" />
        </div>
      )}

      {training.stage === "briefing" && (
        <section className="absolute inset-0 z-30 grid place-items-center bg-[radial-gradient(circle_at_60%_35%,rgba(157,57,12,.24),transparent_40%),rgba(2,3,4,.91)] p-6">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[.35em] text-orange-300">Counterfactual Disaster Trainer</p>
            <h2 className="mt-5 text-4xl font-semibold leading-[.95] tracking-[-.04em] md:text-7xl">One apartment.<br />Two futures.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/65 md:text-lg">Explore a persistent first-person apartment, read the fire cues, make the critical door decision, then rewind the same world to experience its alternative.</p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-xs font-semibold uppercase tracking-[.14em] text-white/45">
              <span>WASD move</span><span>Mouse look</span><span>E interact</span><span>1–2 choose</span>
            </div>
            <button onClick={() => void start()} disabled={busy} className="mt-10 rounded-full bg-orange-500 px-7 py-3.5 text-sm font-bold text-black transition hover:bg-orange-400 disabled:opacity-50">
              {busy ? "Connecting to live world…" : "Begin live scenario"}
            </button>
          </div>
        </section>
      )}

      {training.stage === "error" && (
        <section className="absolute inset-0 z-30 grid place-items-center bg-black/88 p-6">
          <div className="max-w-lg rounded-3xl border border-red-400/20 bg-red-950/20 p-8 backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-[.28em] text-red-300">Live world required</p>
            <h2 className="mt-3 text-3xl font-semibold">The scenario did not start.</h2>
            <p className="mt-4 leading-7 text-white/65">{error ?? training.error}</p>
            <p className="mt-3 text-sm text-white/45">No prerecorded scene is being mislabeled as live. Check the Happy Oyster world ID, capacity, and connection, then retry.</p>
            <button onClick={retry} disabled={busy} className="mt-7 rounded-full bg-white px-6 py-3 text-sm font-bold text-black disabled:opacity-50">{busy ? "Retrying…" : "Retry live connection"}</button>
          </div>
        </section>
      )}

      {active && training.stage !== "debrief" && (
        <section className="absolute inset-x-0 bottom-0 z-20 p-4 md:p-7">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-4">
            {error && <p className="rounded-full border border-red-300/30 bg-red-950/80 px-4 py-2 text-xs text-red-100 backdrop-blur">{error}</p>}
            {hintVisible && <p className="max-w-xl rounded-2xl border border-white/10 bg-black/70 px-5 py-3 text-center text-sm text-white/75 backdrop-blur-xl">{copy.hint}</p>}
            {actions.length > 0 && (
              <div className="flex w-full justify-center gap-3">
                {actions.map((action, index) => (
                  <button key={action} disabled={busy || worldStatus !== "live"} onClick={(event) => { event.stopPropagation(); void performAction(action); }} className="group min-w-0 flex-1 rounded-2xl border border-white/15 bg-black/65 px-4 py-4 text-left backdrop-blur-xl transition hover:border-orange-300/60 hover:bg-black/80 disabled:opacity-40 md:max-w-sm">
                    <span className="mr-3 inline-grid size-7 place-items-center rounded-full border border-white/20 text-xs text-white/55">{index + 1}</span>
                    <span className="font-semibold">{FIRE_ACTION_LABELS[action]}</span>
                    {index === 0 && <span className="float-right mt-1 text-[10px] font-bold tracking-widest text-orange-300/70">E</span>}
                  </button>
                ))}
              </div>
            )}
            {training.stage === "outcome" && (
              <button onClick={(event) => { event.stopPropagation(); void replayAlternative(); }} disabled={busy} className="rounded-full bg-white px-7 py-3 text-sm font-bold text-black transition hover:bg-orange-200 disabled:opacity-50">{busy ? "Restoring same world…" : "Rewind and experience the alternative"}</button>
            )}
            {training.stage === "counterfactual-consequence" && <p className="rounded-full bg-black/70 px-5 py-2 text-sm text-white/70 backdrop-blur">Comparing the same cues with the opposite decision…</p>}
            <div className="flex items-center gap-5 text-[10px] font-bold uppercase tracking-[.16em] text-white/40">
              <span>{pointerLocked ? "Mouse captured · Esc releases" : "Click world for mouse look"}</span>
              <button onClick={(event) => { event.stopPropagation(); setHintVisible((visible) => !visible); if (!hintVisible) dispatch({ type: "REQUEST_HINT" }); }} className="pointer-events-auto text-orange-200/70 hover:text-orange-200">{hintVisible ? "Hide hint" : "Need a hint?"}</button>
              <span>Exposure {training.exposure}%</span>
              {(training.stage === "consequence" || training.stage === "counterfactual-consequence") && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setVisualValid(false);
                    setError("Visual mismatch reported. Safety state is preserved, but this run is now unscored.");
                  }}
                  className="pointer-events-auto hover:text-red-200"
                >
                  Visual mismatch?
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {training.stage === "debrief" && (
        <section className="absolute inset-0 z-30 overflow-y-auto bg-[#070809]/96 p-5 backdrop-blur-xl md:p-10">
          <div className="mx-auto max-w-5xl py-8">
            <p className="text-xs font-bold uppercase tracking-[.3em] text-orange-300">Counterfactual debrief</p>
            <div className="mt-4 grid gap-10 lg:grid-cols-[1.15fr_.85fr]">
              <div>
                <h2 className="text-4xl font-semibold tracking-[-.04em] md:text-6xl">The closed door was a protective barrier.</h2>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-white/65">The continuous alarm, smoke beneath the exit, and warm door were a combined warning not to open it. Keeping it closed limited smoke and heat exposure while you called for help and signaled your location.</p>
                <div className="mt-8 space-y-3">
                  {training.events.map((event, index) => (
                    <div key={`${event.action}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3 rounded-2xl border border-white/8 bg-white/[.03] p-4">
                      <span className="text-sm text-orange-300">{String(index + 1).padStart(2, "0")}</span>
                      <div><p className="font-semibold">{FIRE_ACTION_LABELS[event.action]}</p><p className="mt-1 text-sm leading-6 text-white/50">{event.consequence}</p></div>
                    </div>
                  ))}
                </div>
              </div>
              <aside className="h-fit rounded-3xl border border-white/10 bg-white/[.04] p-6">
                <p className="text-xs font-bold uppercase tracking-[.22em] text-white/45">Readiness assessment</p>
                <p className="mt-4 text-7xl font-semibold tracking-[-.06em]">{assessment.overall}</p>
                <p className="text-sm text-white/45">out of 100 · {assessment.scoreEligible ? "live run" : "not score eligible"}</p>
                <dl className="mt-7 space-y-4 text-sm">
                  {[['Cue recognition', assessment.cueRecognition], ['Action sequence', assessment.actionSequence], ['Hazard exposure', assessment.hazardExposure], ['Resource use', assessment.resourceUse], ['Hint independence', assessment.hintIndependence]].map(([label, value]) => (
                    <div key={String(label)}><div className="flex justify-between"><dt className="text-white/55">{label}</dt><dd>{value}</dd></div><div className="mt-2 h-1 overflow-hidden rounded bg-white/10"><div className="h-full bg-orange-400" style={{ width: `${value}%` }} /></div></div>
                  ))}
                </dl>
                <a href={RED_CROSS_FIRE_GUIDANCE_URL} target="_blank" rel="noreferrer" className="mt-8 block text-sm font-semibold text-orange-300 underline decoration-orange-300/30 underline-offset-4">Read the Red Cross home-fire guidance</a>
                <button onClick={() => window.location.reload()} className="mt-6 w-full rounded-full border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/5">Run the scenario again</button>
              </aside>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
