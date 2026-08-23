"use client";

import React, { useState } from "react";
import { WorldModelStatus } from "@/lib/reactor/client";

interface GenerationStatusProps {
  status: WorldModelStatus;
  mode?: "live" | "fallback";
  modelName?: string;
  fallbackReason?: string | null;
  className?: string;
}

export const GenerationStatus: React.FC<GenerationStatusProps> = ({
  status,
  mode = "live",
  modelName = "LingBot World 2",
  fallbackReason,
  className = "",
}) => {
  const [showDetails, setShowDetails] = useState<boolean>(false);

  // Status visual mapping
  const getStatusBadge = () => {
    switch (status) {
      case "generating":
        return {
          label: mode === "fallback" ? "Prepared Continuation" : "Live Stream",
          dotClass: mode === "fallback" ? "bg-amber-400" : "bg-emerald-400 animate-pulse",
          textClass: "text-emerald-300",
          borderClass: "border-emerald-500/30 bg-emerald-950/40",
        };
      case "connecting":
      case "uploading_image":
        return {
          label: status === "uploading_image" ? "Setting Atmosphere..." : "Connecting to LingBot...",
          dotClass: "bg-blue-400 animate-ping",
          textClass: "text-blue-300",
          borderClass: "border-blue-500/30 bg-blue-950/40",
        };
      case "ready":
        return {
          label: "World Ready",
          dotClass: "bg-teal-400",
          textClass: "text-teal-300",
          borderClass: "border-teal-500/30 bg-teal-950/40",
        };
      case "paused":
        return {
          label: "Decision Frozen",
          dotClass: "bg-amber-400",
          textClass: "text-amber-300",
          borderClass: "border-amber-500/30 bg-amber-950/40",
        };
      case "fallback":
        return {
          label: "Prepared Continuation",
          dotClass: "bg-amber-500",
          textClass: "text-amber-300",
          borderClass: "border-amber-500/30 bg-amber-950/40",
        };
      case "error":
        return {
          label: "World Model Fail-Closed",
          dotClass: "bg-rose-500",
          textClass: "text-rose-300",
          borderClass: "border-rose-500/30 bg-rose-950/40",
        };
      default:
        return {
          label: "Idle",
          dotClass: "bg-neutral-500",
          textClass: "text-neutral-400",
          borderClass: "border-neutral-800 bg-neutral-900/60",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className={`relative z-20 inline-block ${className}`}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono backdrop-blur-md shadow-lg transition-all duration-300 hover:scale-[1.02] ${badge.borderClass}`}
      >
        <span className={`w-2 h-2 rounded-full ${badge.dotClass}`} />
        <span className={`font-medium ${badge.textClass}`}>{badge.label}</span>
        <span className="text-[10px] text-neutral-500 uppercase tracking-widest pl-1 border-l border-neutral-700/50">
          {modelName}
        </span>
      </button>

      {/* Expanded details dropdown */}
      {showDetails && (
        <div className="absolute top-10 left-0 w-72 p-4 rounded-xl bg-neutral-900/95 border border-neutral-800 backdrop-blur-xl shadow-2xl text-xs text-neutral-300 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
            <span className="font-semibold text-white">Reactor Engine Status</span>
            <span className="text-[10px] font-mono text-neutral-400 uppercase">{mode} mode</span>
          </div>

          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-neutral-500">Model:</span>
              <span className="text-neutral-200">{modelName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">State:</span>
              <span className="text-amber-400">{status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Safety Harness:</span>
              <span className="text-emerald-400">Deterministic Active</span>
            </div>
            {fallbackReason && (
              <div className="mt-2 pt-2 border-t border-neutral-800 text-[10px] text-amber-300/80 leading-relaxed">
                <span className="font-semibold">Fallback cause:</span> {fallbackReason}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
