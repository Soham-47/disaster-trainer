"use client";

import React, { useEffect, useRef, useState } from "react";
import type { TrainerRuntimeState } from "@/lib/fire-training/runtime";
import { captureVideoFrame } from "@/lib/lingbot/frame-capture";
import type { LingBotNavigationInput } from "@/lib/lingbot/types";
import { useNavigationControls } from "@/lib/lingbot/use-navigation-controls";

export type LingBotViewportProps = {
  stream: MediaStream | null;
  phase: TrainerRuntimeState;
  transitionFrame: string | null;
  transitionLabel: string | null;
  navigationEnabled: boolean;
  onNavigation: (input: LingBotNavigationInput) => void;
  onCaptureReady: (capture: (() => string) | null) => void;
  onVideoReady: () => void;
};

const transitionPhases = new Set<TrainerRuntimeState>(["checkpointing", "branch_rendering", "rewinding", "alternative", "alternative_rendering"]);

export function LingBotViewport({ stream, phase, transitionFrame, transitionLabel, navigationEnabled, onNavigation, onCaptureReady, onVideoReady }: LingBotViewportProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  useNavigationControls(navigationEnabled, onNavigation);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    setVideoReady(false);
    onCaptureReady(null);
    if (!stream) return;
    let readyConfirmed = false;
    let frameRequest = 0;
    const ready = () => {
      if (readyConfirmed) return true;
      if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;
      readyConfirmed = true;
      setVideoReady(true);
      onCaptureReady(() => captureVideoFrame(video));
      onVideoReady();
      return true;
    };
    const poll = () => {
      if (!ready()) frameRequest = window.requestAnimationFrame(poll);
    };
    video.addEventListener("loadeddata", ready); video.addEventListener("canplay", ready);
    frameRequest = window.requestAnimationFrame(poll);
    void video.play().catch(() => undefined);
    return () => {
      window.cancelAnimationFrame(frameRequest);
      video.removeEventListener("loadeddata", ready); video.removeEventListener("canplay", ready); onCaptureReady(null);
    };
  }, [stream, onCaptureReady, onVideoReady]);
  const showTransition = Boolean(transitionFrame && transitionPhases.has(phase));
  return <div data-testid="lingbot-viewport" className="relative h-full min-h-0 w-full overflow-hidden bg-black">
    <video ref={videoRef} data-testid="lingbot-live-video" autoPlay playsInline muted className={`absolute inset-0 h-full w-full object-cover ${videoReady && !showTransition ? "opacity-100" : "opacity-0"}`} />
    {showTransition && <div data-testid="lingbot-transition-frame" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${transitionFrame})` }} />}
    {!videoReady && !showTransition && <div data-testid="lingbot-loading" className="absolute inset-0 bg-black" />}
    {transitionLabel && showTransition && <div className="absolute inset-x-0 top-6 z-10 text-center text-xs uppercase tracking-[0.25em] text-amber-200">{transitionLabel}</div>}
  </div>;
}
