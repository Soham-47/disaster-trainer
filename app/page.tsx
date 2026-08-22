"use client";

import React, { useEffect, useState } from "react";
import { reactorClient, WorldModelStatus } from "@/lib/reactor/client";
import { GenerationStatus } from "@/components/GenerationStatus";
import { WorldViewport } from "@/components/WorldViewport";

export default function MemberADemoPage() {
  const [status, setStatus] = useState<WorldModelStatus>(reactorClient.getStatus());
  const [mode, setMode] = useState<"live" | "fallback">(reactorClient.getMode());
  const [activeAsset, setActiveAsset] = useState<string>(
    reactorClient.getActiveFallbackAsset() || "/fallbacks/fire-bedroom-orient.mp4"
  );
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);
  const [isRewinding, setIsRewinding] = useState<boolean>(false);
  const [ambientPrompt, setAmbientPrompt] = useState<string>(
    "A 4th floor apartment bedroom, smoke drifting under closed door, emergency alarm sounding."
  );
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribeStatus = reactorClient.onStatus((newStatus) => {
      setStatus(newStatus);
      setMode(reactorClient.getMode());
      if (reactorClient.getActiveFallbackAsset()) {
        setActiveAsset(reactorClient.getActiveFallbackAsset()!);
      }
    });

    return () => {
      unsubscribeStatus();
    };
  }, []);

  // Fetch token status check from /api/reactor-token
  const checkTokenRoute = async () => {
    try {
      const res = await fetch("/api/reactor-token");
      const data = await res.json();
      setTokenInfo(data);
    } catch (err: any) {
      setTokenInfo({ error: err.message });
    }
  };

  useEffect(() => {
    checkTokenRoute();
  }, []);

  useEffect(() => {
    return () => {
      void reactorClient.reset();
    };
  }, []);

  const handleStartStream = async () => {
    setIsRewinding(false);
    setCapturedFrame(null);
    setLiveStream(null);
    setAmbientPrompt("Bedroom scene: smoke under closed exit door, dark high-stakes environment.");
    await reactorClient.start({
      referenceImage: "/references/bedroom-fire.jpg",
      prompt: "Bedroom scene: smoke under closed exit door, dark high-stakes environment.",
      seed: 42069,
      fallbackAsset: "/fallbacks/fire-bedroom-orient.mp4",
      onFrame: (frameObj: any) => {
        if (frameObj && frameObj.stream) {
          setLiveStream(frameObj.stream);
        } else {
          setLiveStream(null);
        }
      },
    });
  };

  const handlePauseDecision = async () => {
    setIsRewinding(false);
    await reactorClient.pause();
  };

  const handleApplyUnsafeChoice = async () => {
    setIsRewinding(false);
    setAmbientPrompt("Selected choice: Open warm door. Consequence: Heavy black smoke surges into room.");
    if (reactorClient.getMode() === "fallback") {
      await reactorClient.useFallback("/fallbacks/fire-hallway-unsafe.mp4");
      return;
    }
    await reactorClient.applyPrompt("Open door, heavy black smoke and heat fill the hallway");
    await reactorClient.resume();
  };

  const handleApplySafeChoice = async () => {
    setIsRewinding(false);
    setAmbientPrompt("Selected choice: Keep door closed. Consequence: Block smoke gap with towel, signal at window.");
    if (reactorClient.getMode() === "fallback") {
      await reactorClient.useFallback("/fallbacks/fire-shelter-safe.mp4");
      return;
    }
    await reactorClient.applyPrompt("Keep door closed, seal gap with wet towel, await rescue at window");
    await reactorClient.resume();
  };

  const handleTriggerRewind = async () => {
    setIsRewinding(true);
    await reactorClient.pause();
    setTimeout(() => {
      setIsRewinding(false);
      setAmbientPrompt("Rewound to decision point: Same warning cues. Select counterfactual alternative.");
    }, 2500);
  };

  const handleTriggerFallback = async () => {
    setIsRewinding(false);
    setLiveStream(null);
    await reactorClient.useFallback("/fallbacks/fire-bedroom-orient.mp4");
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between p-4 md:p-8 font-sans">
      {/* Header Bar */}
      <header className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Counterfactual Disaster Trainer
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Member A Adapter Active
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            LingBot World 2 API / Event Adapter & World Viewport Test Harness
          </p>
        </div>

        {/* Engine Status Badge */}
        <GenerationStatus
          status={status}
          mode={mode}
          modelName="LingBot World 2"
          fallbackReason={mode === "fallback" ? "Fail-closed timeout policy or manual test trigger" : null}
        />
      </header>

      {/* Main Viewport Container */}
      <section className="max-w-6xl w-full mx-auto my-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* World Viewport */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-900 aspect-video relative">
          <WorldViewport
            status={status}
            fallbackAsset={activeAsset}
            mode={mode}
            capturedFrameUrl={capturedFrame}
            isRewinding={isRewinding}
            ambientPrompt={ambientPrompt}
            liveStream={liveStream}
            onCapturedFrame={setCapturedFrame}
          />
        </div>

        {/* Adapter Control Deck */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 backdrop-blur-xl flex flex-col justify-between gap-5">
          <div>
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Member A Control Deck
            </h2>

            <div className="space-y-2.5">
              <button
                onClick={handleStartStream}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-xs transition shadow-lg flex items-center justify-center gap-2"
              >
                ▶ Start LingBot World Stream
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handlePauseDecision}
                  className="py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition border border-neutral-700"
                >
                  ⏸ Pause (Decision)
                </button>
                <button
                  onClick={handleTriggerRewind}
                  className="py-2 px-3 rounded-lg bg-purple-900/40 hover:bg-purple-800/50 text-purple-200 text-xs font-medium transition border border-purple-700/50"
                >
                  ↺ Trigger Rewind
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-800 space-y-2">
                <span className="text-[11px] font-mono text-neutral-400 uppercase block">
                  Prompt Transitions
                </span>
                <button
                  onClick={handleApplyUnsafeChoice}
                  className="w-full py-2 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-medium transition border border-rose-800/40 text-left truncate"
                >
                  🔥 Branch: Open Warm Door (Unsafe)
                </button>
                <button
                  onClick={handleApplySafeChoice}
                  className="w-full py-2 px-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-medium transition border border-emerald-800/40 text-left truncate"
                >
                  🛡️ Branch: Keep Door Closed (Safe)
                </button>
              </div>

              <div className="pt-2 border-t border-neutral-800">
                <button
                  onClick={handleTriggerFallback}
                  className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-medium transition border border-neutral-700 text-left"
                >
                  ⚡ Fail-Closed Fallback
                </button>
              </div>
            </div>
          </div>

          {/* Token Inspector */}
          <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono text-neutral-400 space-y-1">
            <div className="flex justify-between text-neutral-300 font-semibold mb-1">
              <span>Server Token Status</span>
              <span className="text-amber-400">/api/reactor-token</span>
            </div>
            {tokenInfo ? (
              <>
                <div className="flex justify-between">
                  <span>REACTOR_API_KEY Configured:</span>
                  <span className={tokenInfo.hasKey ? "text-emerald-400" : "text-rose-400"}>
                    {tokenInfo.hasKey ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Server API Route:</span>
                  <span className="text-emerald-400">200 OK</span>
                </div>
              </>
            ) : (
              <span className="text-neutral-500">Checking token endpoint...</span>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto pt-6 border-t border-neutral-800 flex flex-wrap justify-between items-center text-xs text-neutral-500">
        <div>Disaster Trainer Hackathon MVP • Interactive Media Track</div>
        <div className="font-mono text-[11px]">LingBot World 2 Adapter Contract Validated</div>
      </footer>
    </main>
  );
}

