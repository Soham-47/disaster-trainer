"use client";

import { useState } from "react";
import { MAX_SCENARIO_BRIEF_LENGTH } from "@/lib/scenario/prompt";

type EntryScreenProps = { onStart: (brief: string) => void; disabled?: boolean };

export function EntryScreen({ onStart, disabled = false }: EntryScreenProps) {
  const [brief, setBrief] = useState("");

  return (
    <section className="max-w-3xl mx-auto rounded-3xl border border-neutral-800 bg-neutral-900/85 p-8 md:p-12 text-center shadow-2xl">
      <p className="text-xs font-mono uppercase tracking-[0.3em] text-amber-300">Guided preparedness practice</p>
      <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight text-white">
        See the choice. Then see the other future.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-300">
        Describe the world you want to enter, make one constrained decision, experience its consequence, rewind, and test what you learned in a new setting.
      </p>
      <div className="mx-auto mt-8 max-w-2xl text-left">
        <label htmlFor="scenario-brief" className="text-xs font-mono uppercase tracking-[0.2em] text-neutral-400">
          Describe the visual situation (optional)
        </label>
        <textarea
          id="scenario-brief"
          value={brief}
          maxLength={MAX_SCENARIO_BRIEF_LENGTH}
          onChange={(event) => setBrief(event.target.value)}
          placeholder="Example: A smoky underground station during a blackout, viewed from a passenger's eye level."
          rows={3}
          className="mt-2 w-full resize-none rounded-xl border border-neutral-700 bg-neutral-950/80 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-neutral-600 focus:border-amber-300 focus:ring-2 focus:ring-amber-200/30"
          disabled={disabled}
        />
        <div className="mt-2 flex justify-between gap-4 text-xs text-neutral-500">
          <span>Shapes visuals and camera atmosphere only; safety choices stay controlled.</span>
          <span>{brief.length}/{MAX_SCENARIO_BRIEF_LENGTH}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onStart(brief)}
        disabled={disabled}
        className="mt-8 rounded-xl bg-amber-400 px-6 py-3 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-500/10 transition hover:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-wait disabled:opacity-50"
      >
        {disabled ? "Preparing the world..." : "Start featured scenario"}
      </button>
      <p className="mt-5 text-xs text-neutral-500">Experimental prototype · not certified emergency training</p>
    </section>
  );
}

