"use client";

import { useEffect, useMemo, useState } from "react";
import { LingBotViewport } from "./LingBotViewport";
import { LingBotDiagnostics } from "./LingBotDiagnostics";
import { FIRE_ACTION_LABELS, FIRE_STAGE_COPY, RED_CROSS_FIRE_GUIDANCE_URL } from "@/lib/fire-training/content";
import { availableFireActions } from "@/lib/fire-training/reducer";
import { useLingBotFireController } from "@/lib/fire-training/use-lingbot-fire-controller";
import type { FireAction } from "@/lib/fire-training/actions";

const startupCopy = {
  connecting: "Connecting to LingBot World 2…",
  uploading: "Uploading the reference scene…",
  rendering: "Rendering the first live scene…",
  idle: "Begin scenario",
} as const;

export function LingBotFireTrainer() {
  const controller = useLingBotFireController();
  const dispose = controller.dispose;
  const [debug, setDebug] = useState(false);
  useEffect(() => setDebug(new URLSearchParams(window.location.search).get("debug") === "1"), []);
  useEffect(() => () => { void dispose(); }, [dispose]);

  const copy = FIRE_STAGE_COPY[controller.runtime.training.stage];
  const actions = useMemo(() => availableFireActions(controller.runtime.training), [controller.runtime.training]);
  const startupBusy = controller.startupStage !== "idle";
  const liveBusy = controller.runtime.pendingAction !== null
    || controller.runtime.phase.includes("rendering")
    || controller.runtime.phase === "checkpointing";
  const statusMessage = controller.operationStatus
    ?? (controller.runtime.phase === "checkpointing" ? "Preparing the decision checkpoint…" : null)
    ?? (controller.runtime.phase.includes("rendering") ? "Rendering the selected future…" : null);
  const startupLabel = startupBusy ? startupCopy[controller.startupStage] : controller.startupError ? "Live world unavailable" : startupCopy.idle;
  const controlsReady = controller.runtime.phase !== "booting" && controller.runtime.phase !== "fatal";

  if (controller.runtime.phase === "booting" || controller.runtime.phase === "fatal") {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-950 p-6 text-neutral-100">
        <section className="max-w-md text-center" aria-busy={startupBusy}>
          <p className="text-xs uppercase tracking-[.3em] text-amber-300">Apartment fire · live training</p>
          <h1 className="mt-4 text-4xl font-semibold">{startupLabel}</h1>
          <p className="mt-4 text-neutral-400">A real first-person world must publish its video and first chunk before controls appear.</p>
          {startupBusy && <p role="status" aria-live="polite" className="mt-5 flex items-center justify-center gap-2 text-sm text-amber-200"><span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-200" />{startupCopy[controller.startupStage]} · {controller.startupElapsedSeconds}s elapsed</p>}
          {(controller.startupError || controller.runtime.error) && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">{controller.startupError ?? controller.runtime.error}</p>}
          <p className="mt-3 text-xs text-neutral-500">Startup can take up to two minutes while the live model negotiates and renders its first frame.</p>
          <button type="button" onClick={() => void controller.start()} disabled={startupBusy} aria-busy={startupBusy} className="mt-6 rounded-full bg-amber-300 px-6 py-3 font-semibold text-neutral-950 disabled:cursor-wait disabled:opacity-50">{startupBusy ? "Preparing live world…" : controller.startupError || controller.runtime.error ? "Retry live world" : "Begin scenario"}</button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="text-[10px] uppercase tracking-[.28em] text-amber-300">Apartment fire · live training</p><h1 className="mt-1 text-xl font-semibold">{copy.priority}</h1></div>{debug && <LingBotDiagnostics phase={controller.runtime.phase} branchLatencyMs={controller.branchLatencyMs} />}</header>
      <section className="relative min-h-[70vh] flex-1" aria-busy={liveBusy}>
        <LingBotViewport stream={controller.stream} phase={controller.runtime.phase} transitionFrame={controller.transitionFrame} transitionLabel={controller.transitionLabel} navigationEnabled={controlsReady && !liveBusy} onNavigation={controller.setNavigation} onCaptureReady={controller.setCapture} onVideoReady={() => undefined} />
        <div className="pointer-events-none absolute inset-x-0 top-5 z-10 text-center"><p className="inline-block rounded-full bg-black/60 px-4 py-2 text-sm text-neutral-200">{copy.prompt}</p></div>
        {statusMessage && <div role="status" aria-live="polite" aria-atomic="true" className="absolute inset-x-4 top-16 z-20 mx-auto max-w-xl rounded-full border border-amber-200/30 bg-black/75 px-4 py-2 text-center text-sm text-amber-100">{statusMessage}</div>}
        {controller.runtime.phase === "debrief" ? (
          <div className="absolute inset-0 z-20 overflow-auto bg-neutral-950/95 p-6"><div className="mx-auto max-w-2xl py-10"><p className="text-xs uppercase tracking-[.28em] text-amber-300">Counterfactual debrief</p><h2 className="mt-3 text-4xl font-semibold">The closed door is a protective barrier.</h2><p className="mt-5 leading-7 text-neutral-300">Smoke beneath a warm door is a warning cue. Keep the door closed, call emergency services, and signal your location rather than opening into smoke and heat.</p><a className="mt-5 inline-block text-sm text-amber-200 underline" href={RED_CROSS_FIRE_GUIDANCE_URL} target="_blank" rel="noreferrer">Read the Red Cross fire guidance</a><button type="button" onClick={() => void controller.replay()} className="mt-8 block rounded-xl bg-amber-300 px-5 py-3 font-semibold text-neutral-950">Replay scenario</button></div></div>
        ) : (
          <div className="absolute inset-x-4 bottom-5 z-20 mx-auto max-w-3xl rounded-2xl border border-white/10 bg-neutral-950/85 p-4 backdrop-blur">
            {actions.length > 0 && <div className="flex flex-wrap gap-2">{actions.map((action: FireAction, index) => <button key={action} type="button" disabled={liveBusy} aria-label={`Option ${index + 1}: ${FIRE_ACTION_LABELS[action]}`} onClick={() => void controller.submit(action)} className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left text-sm hover:border-amber-300/60 disabled:cursor-wait disabled:opacity-40"><span aria-hidden="true" className="mr-2 text-amber-300">{index + 1}</span>{FIRE_ACTION_LABELS[action]}</button>)}</div>}
            {controller.runtime.error && <div className="mt-3 flex items-center justify-between gap-3 text-sm text-red-200"><span role="alert">{controller.runtime.error}</span><button type="button" onClick={() => void controller.retryBranch()} className="rounded-full border border-red-300/40 px-3 py-1">Retry</button></div>}
            {controller.runtime.phase === "consequence" && <button type="button" disabled={liveBusy} onClick={() => void controller.startAlternative()} className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-3 font-semibold text-neutral-950 disabled:cursor-wait disabled:opacity-50">Rewind to the decision</button>}
            {controller.runtime.phase === "alternative" && controller.runtime.training.stage === "counterfactual-consequence" && <button type="button" onClick={controller.showDebrief} className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-3 font-semibold text-neutral-950">View debrief</button>}
          </div>
        )}
      </section>
    </main>
  );
}
