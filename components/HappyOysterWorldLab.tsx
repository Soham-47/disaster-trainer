"use client";

import { useEffect, useRef, useState } from "react";
import { HappyOysterModel, type TravelStateMessage } from "@reactor-models/happy-oyster";
import { FIRE_REFERENCE_IMAGE, FIRE_WORLD_PROMPT } from "@/lib/fire-training/content";

export function HappyOysterWorldLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const modelRef = useRef<HappyOysterModel<"adventure"> | null>(null);
  const [status, setStatus] = useState("Ready to build");
  const [worldId, setWorldId] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => void modelRef.current?.disconnect(), []);

  const build = async () => {
    if (!videoRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      setStatus("Minting Adventure token");
      const sessionResponse = await fetch("/api/happy-oyster-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "build" }),
      });
      const session = await sessionResponse.json();
      if (!sessionResponse.ok || !session.token) throw new Error(session.message ?? "Could not create builder session.");

      const model = new HappyOysterModel({ mode: "adventure", videoElement: videoRef.current });
      modelRef.current = model;
      model.onPhaseChanged((phase) => setStatus(phase.replaceAll("_", " ")));
      model.onTravelState((state: TravelStateMessage) =>
        setActions([...state.environment_actions, ...state.character_actions])
      );
      model.onTravelError((cause) => setError(cause instanceof Error ? cause.message : String(cause)));
      await model.connect(session.token);

      setStatus("Uploading reference and building permanent world");
      const imageResponse = await fetch(FIRE_REFERENCE_IMAGE);
      if (!imageResponse.ok) throw new Error("The apartment reference image could not be loaded.");
      const firstFrameImage = await imageResponse.blob();
      const world = await model.createWorld({
        prompt: FIRE_WORLD_PROMPT,
        perspective: "first_person",
        firstFrameImage,
      });
      if (!world.encrypted_world_id) throw new Error("Happy Oyster returned no permanent world ID.");
      setWorldId(world.encrypted_world_id);

      setStatus("Opening validation travel");
      const travel = await model.startTravel();
      if (!travel.streaming) throw new Error("The new world did not publish a live validation stream.");
      setStatus("Live validation ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "World creation failed.");
      setStatus("Build failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#090a0c] p-6 text-white md:p-10">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[.3em] text-orange-300">Developer-only setup</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Happy Oyster apartment world lab</h1>
        <p className="mt-4 max-w-3xl leading-7 text-white/60">Build the permanent first-person world once, validate its live stream and advertised actions, then copy its encrypted ID into <code className="text-orange-200">HAPPY_OYSTER_FIRE_WORLD_ID</code> in <code className="text-orange-200">.env.local</code>.</p>

        <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Status</p>
            <p className="mt-2 text-lg">{status}</p>
            {error && <p className="mt-3 text-sm leading-6 text-red-300">{error}</p>}
            <button onClick={() => void build()} disabled={busy} className="mt-5 rounded-full bg-orange-500 px-6 py-3 text-sm font-bold text-black disabled:opacity-50">{busy ? "Building…" : "Build and validate world"}</button>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Permanent world ID</p>
            <code className="mt-2 block break-all text-sm text-emerald-300">{worldId || "Not created yet"}</code>
            {worldId && <button onClick={() => void navigator.clipboard.writeText(worldId)} className="mt-4 text-sm font-semibold text-orange-300">Copy world ID</button>}
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-white/40">Advertised actions</p>
            <p className="mt-2 text-sm leading-6 text-white/60">{actions.length ? actions.join(" · ") : "Available after validation travel starts"}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
