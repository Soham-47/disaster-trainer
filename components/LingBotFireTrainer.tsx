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
      <main className="trainer-start grid min-h-[100dvh] place-items-center overflow-hidden p-6 text-neutral-100">
        <section className="trainer-glass w-full max-w-lg rounded-[2rem] p-7 text-center sm:p-10" aria-busy={startupBusy}>
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-amber-200/25 bg-amber-100/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.28em] text-amber-200"><span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_14px_#fbbf24]" /> Live world training</div>
          <p className="trainer-kicker mt-8">Apartment fire · night scenario</p>
          <h1 className="trainer-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{startupLabel}</h1>
          <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-white/60">A real first-person world must publish its video and first chunk before controls appear.</p>
          {startupBusy && <p role="status" aria-live="polite" className="mt-6 flex items-center justify-center gap-2 text-sm text-amber-100"><span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200/30 border-t-amber-200" />{startupCopy[controller.startupStage]} · {controller.startupElapsedSeconds}s elapsed</p>}
          {(controller.startupError || controller.runtime.error) && <p role="alert" className="mt-5 rounded-2xl border border-red-300/25 bg-red-950/40 p-4 text-left text-sm leading-6 text-red-100">{controller.startupError ?? controller.runtime.error}</p>}
          <p className="mt-5 text-xs text-white/35">Startup can take up to two minutes while the live model negotiates and renders its first frame.</p>
          <button type="button" onClick={() => void controller.start()} disabled={startupBusy} aria-busy={startupBusy} className="mt-7 w-full rounded-2xl bg-amber-300 px-6 py-3.5 text-sm font-bold text-neutral-950 shadow-[0_12px_40px_rgba(251,191,36,.2)] transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-50">{startupBusy ? "Preparing live world…" : controller.startupError || controller.runtime.error ? "Retry live world" : "Begin scenario"}</button>
        </section>
      </main>
    );
  }

  return (
    <main data-testid="trainer-shell" className="relative h-[100dvh] min-h-[560px] overflow-hidden bg-[#080604] text-neutral-100">
      <section className="absolute inset-0" aria-busy={liveBusy}>
        <LingBotViewport stream={controller.stream} phase={controller.runtime.phase} transitionFrame={controller.transitionFrame} transitionLabel={controller.transitionLabel} navigationEnabled={controlsReady && !liveBusy} onNavigation={controller.setNavigation} onCaptureReady={controller.setCapture} onVideoReady={() => undefined} />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-5 pb-24 pt-5 sm:px-8 sm:pt-7">
          <header className="mx-auto flex max-w-7xl items-start justify-between gap-4">
            <div><p className="trainer-kicker text-amber-200">Apartment fire · live training</p><h1 className="trainer-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{copy.priority}</h1><p className="mt-2 max-w-xl text-sm leading-5 text-white/65 sm:text-base">{copy.prompt}</p></div>
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-emerald-200/25 bg-black/35 px-3 py-2 text-[10px] font-bold uppercase tracking-[.2em] text-emerald-100 backdrop-blur-md"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" /> Live world</div>
          </header>
          {debug && <div className="pointer-events-auto mt-4 flex justify-end"><LingBotDiagnostics phase={controller.runtime.phase} branchLatencyMs={controller.branchLatencyMs} /></div>}
        </div>
        {statusMessage && <div role="status" aria-live="polite" aria-atomic="true" className="absolute inset-x-4 top-32 z-20 mx-auto max-w-xl rounded-full border border-amber-200/30 bg-black/70 px-4 py-2.5 text-center text-sm text-amber-100 shadow-lg backdrop-blur-md sm:top-36">{statusMessage}</div>}
        {controller.runtime.phase === "debrief" ? (
          <div className="absolute inset-0 z-20 overflow-auto bg-[#0d0907]/95 p-6 backdrop-blur-xl"><div className="mx-auto max-w-2xl py-10 sm:py-16"><p className="trainer-kicker text-amber-200">Counterfactual debrief</p><h2 className="trainer-display mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">The closed door is a protective barrier.</h2><p className="mt-6 max-w-xl text-base leading-8 text-white/70">Smoke beneath a warm door is a warning cue. Keep the door closed, call emergency services, and signal your location rather than opening into smoke and heat.</p><a className="mt-6 inline-block text-sm text-amber-200 underline underline-offset-4" href={RED_CROSS_FIRE_GUIDANCE_URL} target="_blank" rel="noreferrer">Read the Red Cross fire guidance</a><button type="button" onClick={() => void controller.replay()} className="mt-9 block rounded-2xl bg-amber-300 px-5 py-3.5 text-sm font-bold text-neutral-950 shadow-[0_12px_40px_rgba(251,191,36,.18)]">Replay scenario</button></div></div>
        ) : (
          <div data-testid="action-dock" className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-[#080604] via-[#080604e8] to-transparent px-4 pb-4 pt-16 sm:px-8 sm:pb-7 sm:pt-20">
            <div className="trainer-glass mx-auto max-w-5xl rounded-[1.5rem] p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3"><div><p className="trainer-kicker text-amber-200">Immediate priority</p><p className="mt-1 text-sm font-medium text-white/80">{copy.hint}</p></div><span className="hidden rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/45 sm:inline">{liveBusy ? "Rendering" : "Choose an action"}</span></div>
            {actions.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{actions.map((action: FireAction, index) => <button key={action} type="button" disabled={liveBusy} aria-label={`Option ${index + 1}: ${FIRE_ACTION_LABELS[action]}`} onClick={() => void controller.submit(action)} className="trainer-action group flex min-h-14 items-center rounded-xl border border-white/15 bg-white/[.07] px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-amber-300/70 hover:bg-amber-100/10 disabled:cursor-wait disabled:opacity-40"><span aria-hidden="true" className="mr-3 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-300/15 text-xs font-bold text-amber-200 transition group-hover:bg-amber-300 group-hover:text-neutral-950">{index + 1}</span><span className="font-medium">{FIRE_ACTION_LABELS[action]}</span></button>)}</div>}
            {controller.runtime.error && <div className="mt-3 flex items-center justify-between gap-3 text-sm text-red-200"><span role="alert">{controller.runtime.error}</span><button type="button" onClick={() => void controller.retryBranch()} className="rounded-full border border-red-300/40 px-3 py-1">Retry</button></div>}
            {controller.runtime.phase === "consequence" && <button type="button" disabled={liveBusy} onClick={() => void controller.startAlternative()} className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-3 font-semibold text-neutral-950 disabled:cursor-wait disabled:opacity-50">Rewind to the decision</button>}
            {controller.runtime.phase === "alternative" && controller.runtime.training.stage === "counterfactual-consequence" && <button type="button" onClick={controller.showDebrief} className="mt-3 w-full rounded-xl bg-amber-300 px-4 py-3 font-semibold text-neutral-950">View debrief</button>}
              <p className="mt-4 text-center text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">WASD to move · drag to look · actions are safety-reviewed</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
