"use client";

import React, { useState, useEffect } from "react";
import { FireSpikeState, SpikeAction } from "@/lib/renderer-spike/types";
import { INTERACTIVE_OBJECTS } from "@/lib/renderer-spike/interactive-objects";

interface SpikeUIProps {
  state: FireSpikeState;
  dispatch: React.Dispatch<SpikeAction>;
  activeTargetId: string | null;
  pointerLocked: boolean;
  onLockPointer: () => void;
  debugColliders: boolean;
  setDebugColliders: (debug: boolean) => void;
  onCaptureFrame: () => void;
}

export const SpikeUI: React.FC<SpikeUIProps> = ({
  state,
  dispatch,
  activeTargetId,
  pointerLocked,
  onLockPointer,
  debugColliders,
  setDebugColliders,
  onCaptureFrame,
}) => {
  const [showFps, setShowFps] = useState(false);
  const [fps, setFps] = useState(60);
  const [frameTime, setFrameTime] = useState(16.6);
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Toggle FPS readout on backtick key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Backquote") {
        setShowFps((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Performance FPS counter loop
  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;
    let animId: number;

    const tick = (now: number) => {
      frames++;
      if (now >= lastTime + 500) {
        const measuredFps = Math.round((frames * 1000) / (now - lastTime));
        setFps(measuredFps);
        setFrameTime(parseFloat((1000 / Math.max(1, measuredFps)).toFixed(1)));
        frames = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const currentObjectSpec = activeTargetId
    ? INTERACTIVE_OBJECTS[activeTargetId as keyof typeof INTERACTIVE_OBJECTS]
    : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 text-white font-sans select-none">
      {/* Upper Bar */}
      <div className="flex justify-between items-start">
        {/* Upper Left: Objective */}
        <div className="bg-black/85 backdrop-blur-md p-4 rounded-xl border border-white/10 max-w-md shadow-2xl pointer-events-auto">
          <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            Current Objective
          </div>
          <div className="text-sm font-medium leading-relaxed">{state.currentObjective}</div>
        </div>

        {/* Upper Right: Hazard Exposure */}
        <div className="bg-black/85 backdrop-blur-md p-4 rounded-xl border border-white/10 w-64 shadow-2xl pointer-events-auto">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs uppercase tracking-wider text-rose-400 font-semibold">
              Hazard Exposure
            </span>
            <span className="text-sm font-bold text-rose-300">{state.hazardExposure}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden border border-white/10">
            <div
              className={`h-full transition-all duration-300 ${
                state.hazardExposure > 60
                  ? "bg-gradient-to-r from-orange-500 to-red-600"
                  : state.hazardExposure > 30
                  ? "bg-gradient-to-r from-amber-500 to-orange-500"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, state.hazardExposure))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Center Screen: Reticle & Prompt */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Reticle Dot */}
        <div
          className={`w-3 h-3 rounded-full border-2 transition-transform duration-150 ${
            currentObjectSpec
              ? "bg-amber-400 border-white scale-125 shadow-[0_0_12px_#fbbf24]"
              : "bg-white/40 border-black/50"
          }`}
        />

        {/* Contextual Interaction Prompt */}
        {currentObjectSpec && (
          <div className="mt-8 bg-black/90 text-amber-300 px-5 py-2.5 rounded-full border border-amber-500/40 text-sm font-semibold tracking-wide shadow-2xl flex items-center gap-2 animate-bounce">
            <span className="bg-amber-500 text-black px-2 py-0.5 rounded font-mono font-bold text-xs">
              E
            </span>
            <span>
              {state.doorInspected && currentObjectSpec.id === "bedroom-door" && !state.doorOpen
                ? "Open Bedroom Door (Unsafe Action)"
                : currentObjectSpec.promptText}
            </span>
          </div>
        )}

        {/* Hot Door Explicit Choice Overlay when Inspected */}
        {state.doorInspected && !state.doorOpen && (
          <div className="mt-4 flex gap-3 pointer-events-auto">
            <button
              onClick={() =>
                dispatch({
                  type: "EXECUTE_INTERACTION",
                  objectId: "bedroom-door",
                  interaction: "open-door",
                })
              }
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2 rounded-lg border border-red-400 shadow-lg transition"
            >
              Open Door (Unsafe Consequence)
            </button>
            <button
              onClick={() =>
                dispatch({
                  type: "EXECUTE_INTERACTION",
                  objectId: "bedroom-door",
                  interaction: "keep-door-closed",
                })
              }
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg border border-emerald-400 shadow-lg transition"
            >
              Keep Door Closed (Safer Consequence)
            </button>
          </div>
        )}
      </div>

      {/* Pointer Lock Lock-Screen Hint */}
      {!pointerLocked && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto z-20">
          <div className="bg-gray-900 border border-white/20 p-6 rounded-2xl max-w-sm text-center shadow-2xl">
            <h2 className="text-xl font-bold text-amber-400 mb-2">3D Apartment Fire Spike</h2>
            <p className="text-xs text-gray-300 mb-4 leading-relaxed">
              Click anywhere on screen to lock pointer and enter 3D first-person camera mode. Use WASD to move, Ctrl to crouch, and E to interact.
            </p>
            <button
              onClick={onLockPointer}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 px-4 rounded-xl transition shadow-lg text-sm"
            >
              Click to Start First-Person Control
            </button>
          </div>
        </div>
      )}

      {/* Audio Caption & Bottom Bar */}
      <div className="flex justify-between items-end">
        {/* Audio Caption Overlay */}
        <div className="bg-black/85 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-xs font-mono text-cyan-300 max-w-md pointer-events-auto">
          {state.activeAudioCaption || "[AUDIO - Environmental fire audio active]"}
        </div>

        {/* Backtick FPS Readout (visible only with ` key) */}
        {showFps && (
          <div className="bg-black/90 text-emerald-400 font-mono text-xs p-3 rounded-xl border border-emerald-500/40 shadow-xl pointer-events-auto">
            <div>FPS: {fps} (Target: 55+)</div>
            <div>Frame Time: {frameTime} ms</div>
            <div>DPR: {typeof window !== "undefined" ? window.devicePixelRatio : 1}</div>
          </div>
        )}

        {/* Developer Drawer */}
        <div className="bg-gray-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/15 shadow-2xl w-80 pointer-events-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Developer Controls
            </span>
            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="text-xs text-gray-400 hover:text-white"
            >
              {drawerOpen ? "Minimize" : "Expand"}
            </button>
          </div>

          {drawerOpen && (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => dispatch({ type: "SAVE_CHECKPOINT" })}
                  className="bg-amber-600/80 hover:bg-amber-500 text-white font-semibold py-2 px-3 rounded-lg border border-amber-400/40 transition"
                >
                  Save Checkpoint
                </button>
                <button
                  onClick={() => dispatch({ type: "RESTORE_CHECKPOINT" })}
                  disabled={!state.checkpoint}
                  className={`py-2 px-3 rounded-lg border font-semibold transition ${
                    state.checkpoint
                      ? "bg-blue-600/80 hover:bg-blue-500 text-white border-blue-400/40"
                      : "bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed"
                  }`}
                >
                  Restore Checkpoint
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDebugColliders(!debugColliders)}
                  className={`py-2 px-3 rounded-lg border font-semibold transition ${
                    debugColliders
                      ? "bg-purple-600 text-white border-purple-400"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700"
                  }`}
                >
                  {debugColliders ? "Debug: ON" : "Debug Colliders"}
                </button>

                <button
                  onClick={() => dispatch({ type: "TOGGLE_REDUCED_MOTION" })}
                  className={`py-2 px-3 rounded-lg border font-semibold transition ${
                    state.reducedMotion
                      ? "bg-amber-600 text-white border-amber-400"
                      : "bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700"
                  }`}
                >
                  {state.reducedMotion ? "Motion: Reduced" : "Reduced Motion"}
                </button>
              </div>

              <button
                onClick={onCaptureFrame}
                className="w-full bg-teal-600/80 hover:bg-teal-500 text-white font-semibold py-2 px-3 rounded-lg border border-teal-400/40 transition"
              >
                captureRendererFrame() [JPEG URL]
              </button>

              <button
                onClick={() => dispatch({ type: "RESET_SIMULATION" })}
                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white py-1.5 px-3 rounded-lg transition text-[11px]"
              >
                Reset Prototype State
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
