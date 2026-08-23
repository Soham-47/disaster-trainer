"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { reactorClient, WorldModelStatus } from "@/lib/reactor/client";
import type { WorldModelNavigationInput } from "@/lib/reactor/client";
import { getViewportMediaMode } from "@/lib/player/viewport-media";
import { idleNavigation, navigationFromKeys } from "@/lib/player/navigation";
import type { DisasterType } from "@/lib/scenario/types";

interface WorldViewportProps {
  status: WorldModelStatus;
  fallbackAsset?: string;
  capturedFrameUrl?: string | null;
  isRewinding?: boolean;
  onVideoEnd?: () => void;
  className?: string;
  ambientPrompt?: string;
  visualBranch?: "orient" | "safe" | "unsafe";
  liveStream?: MediaStream | null;
  mode?: "live" | "fallback";
  onCapturedFrame?: (frameUrl: string) => void;
  onNavigation?: (input: WorldModelNavigationInput) => void;
  disasterType?: DisasterType;
  transitionLabel?: string | null;
}

export const WorldViewport: React.FC<WorldViewportProps> = ({
  status,
  fallbackAsset = "/fallbacks/fire-bedroom-orient.mp4",
  capturedFrameUrl,
  isRewinding = false,
  onVideoEnd,
  className = "",
  ambientPrompt = "",
  visualBranch = "orient",
  liveStream,
  mode = "live",
  onCapturedFrame,
  onNavigation,
  disasterType,
  transitionLabel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const capturedForPauseRef = useRef<boolean>(false);
  const [localFrameUrl, setLocalFrameUrl] = useState<string | null>(capturedFrameUrl || null);
  const [liveVideoReady, setLiveVideoReady] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const mediaMode = getViewportMediaMode({
    mode,
    liveStream: Boolean(liveStream),
    liveVideoReady,
    fallbackAsset: fallbackAsset || null,
  });
  const showFallbackVideo = mediaMode === "fallback-video";
  const showFallbackImage = mediaMode === "fallback-image";
  const liveVideoVisible = mediaMode === "live-video";
  const showFallbackMedia = showFallbackVideo || showFallbackImage;

  useEffect(() => {
    if (capturedFrameUrl) {
      setLocalFrameUrl(capturedFrameUrl);
    } else {
      setLocalFrameUrl(null);
    }
  }, [capturedFrameUrl]);

  // Connect the model's WebRTC stream to the first-person video element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setLiveVideoReady(false);
    video.srcObject = liveStream ?? null;
    if (!liveStream) return;

    const markReady = () => setLiveVideoReady(true);
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.play().catch((err) => {
      console.warn("[WorldViewport] Live video play failed:", err);
    });

    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, [liveStream]);

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === "visible");
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!onNavigation) return;
    const pressedKeys = new Set<string>();
    const navigationKeys = new Set(["w", "a", "s", "d", "W", "A", "S", "D", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
    const isTextEntry = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.isContentEditable;
    };
    const update = () => onNavigation(navigationFromKeys(pressedKeys));
    const onKeyDown = (event: KeyboardEvent) => {
      if (!navigationKeys.has(event.key) || isTextEntry(event.target)) return;
      event.preventDefault();
      pressedKeys.add(event.key);
      update();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (!navigationKeys.has(event.key)) return;
      pressedKeys.delete(event.key);
      update();
    };
    const clear = () => {
      pressedKeys.clear();
      onNavigation(idleNavigation);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      clear();
    };
  }, [onNavigation]);

  // Reset captured flag when status changes out of paused
  useEffect(() => {
    if (status !== "paused") {
      capturedForPauseRef.current = false;
    }
  }, [status]);

  // Capture the last actual model frame when possible. The video element keeps
  // its last frame after the SDK pauses, so the learner rewinds to real model
  // context rather than the decorative canvas.
  useEffect(() => {
    if (status !== "paused" || capturedForPauseRef.current) return;

    const captureFrame = () => {
      if (capturedForPauseRef.current) return;

      const video = mode === "live" ? videoRef.current : fallbackVideoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const captureCanvas = document.createElement("canvas");
      const sourceVideoReady = Boolean(video && video.readyState >= 2 && video.videoWidth > 0);
      captureCanvas.width = sourceVideoReady ? video!.videoWidth : canvas.width;
      captureCanvas.height = sourceVideoReady ? video!.videoHeight : canvas.height;

      try {
        const context = captureCanvas.getContext("2d");
        if (!context) return;
        if (sourceVideoReady) {
          context.drawImage(video!, 0, 0, captureCanvas.width, captureCanvas.height);
        } else {
          context.drawImage(canvas, 0, 0, captureCanvas.width, captureCanvas.height);
        }
        const frame = captureCanvas.toDataURL("image/jpeg", 0.85);
        capturedForPauseRef.current = true;
        setLocalFrameUrl(frame);
        reactorClient.setCapturedFrame(frame);
        onCapturedFrame?.(frame);
      } catch (error) {
        console.warn("[WorldViewport] Decision frame capture failed:", error);
      }
    };

    const frameId = requestAnimationFrame(captureFrame);
    return () => cancelAnimationFrame(frameId);
  }, [status, liveStream, mode, onCapturedFrame]);

  // Determine active visual state from prompt content
  const isUnsafeBranch = visualBranch === "unsafe";
  const isSafeBranch = visualBranch === "safe";

  // Live mode must never invent a disaster scene while the model track is absent.
  useEffect(() => {
    if (mediaMode !== "waiting" || !pageVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 1280;
    const height = 720;
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "600 24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Waiting for live LingBot video…", width / 2, height / 2 - 12);
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#71717a";
    ctx.fillText("The selected disaster will appear when the model publishes a video track.", width / 2, height / 2 + 22);
    ctx.textAlign = "start";

    if (isRewinding) {
      ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
      ctx.fillRect(0, 0, width, height);
    }
  }, [isRewinding, mediaMode, pageVisible]);

  return (
    <div
      className={`relative w-full h-full min-h-[480px] bg-neutral-950 overflow-hidden select-none flex items-center justify-center ${disasterType ? `world-${disasterType}` : ""} ${className}`}
    >
      {/* Background Radial Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/70 z-10 pointer-events-none" />

      {/* Live Stream Video Element (WebRTC Track) */}
      <video
        data-world-media="true"
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onError={() => setLiveVideoReady(false)}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 z-10 ${
          liveVideoVisible && (status === "generating" || status === "paused")
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Fallback Prepared Video Element */}
      {showFallbackVideo && (
        <video
          data-world-media="true"
          ref={fallbackVideoRef}
          src={fallbackAsset}
          autoPlay
          loop
          playsInline
          muted
          onEnded={onVideoEnd}
          className="absolute inset-0 w-full h-full object-cover z-10"
        />
      )}

      {showFallbackImage && (
        <Image
          data-world-media="true"
          src={fallbackAsset}
          alt="Prepared disaster continuation"
          fill
          unoptimized
          sizes="100vw"
          className="absolute inset-0 z-10 h-full w-full object-cover"
        />
      )}

      {/* Neutral waiting canvas shown only until a live track or prepared fallback media is ready */}
      <canvas
        data-world-media="true"
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
          showFallbackMedia || liveVideoVisible
            ? "opacity-0"
            : status === "paused"
            ? "opacity-75"
            : "opacity-100"
        } ${status === "paused" || isRewinding ? "blur-sm scale-[1.02]" : "scale-100"}`}
      />

      {/* Decision Snapshot Overlay Layer */}
      {(status === "paused" || localFrameUrl) && status !== "generating" && (
        <div
          className={`absolute inset-0 z-30 transition-opacity duration-500 pointer-events-none ${
            isRewinding ? "opacity-90 animate-pulse" : "opacity-80"
          }`}
        >
          {localFrameUrl && (
            <Image
              data-world-media="true"
              src={localFrameUrl}
              alt="Captured Decision Context Frame"
              fill
              unoptimized
              sizes="100vw"
              className={`w-full h-full object-cover ${
                isRewinding ? "scale-105 filter saturate-150 contrast-125 invert-10" : ""
              }`}
            />
          )}
        </div>
      )}

      {/* Rewind Banner */}
      {transitionLabel && (
        <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center bg-amber-950/40 backdrop-blur-sm">
          <div className="text-amber-300 font-mono text-xs tracking-widest uppercase mb-2 animate-pulse bg-amber-950/90 px-4 py-1.5 rounded-full border border-amber-500/40 shadow-2xl">
            {transitionLabel}
          </div>
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
        </div>
      )}

      {disasterType && (
        <div
          aria-hidden="true"
          data-testid="disaster-effects"
          data-disaster-type={disasterType}
          className={`world-effects world-effects-${disasterType}`}
        />
      )}

      {/* World Context Badge */}
      {ambientPrompt && (
        <div className="absolute top-6 left-6 z-20 max-w-xl bg-neutral-900/90 backdrop-blur-md border border-neutral-800/80 rounded-xl px-4 py-2.5 text-xs text-neutral-300 shadow-2xl flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isUnsafeBranch
                ? "bg-rose-500 animate-ping"
                : isSafeBranch
                ? "bg-emerald-400 animate-pulse"
                : "bg-amber-500 animate-pulse"
            } shrink-0`}
          />
          <span className="font-mono text-neutral-400 uppercase tracking-widest text-[10px] shrink-0">
            World Context:
          </span>
          <span className="truncate italic font-sans text-neutral-200">{ambientPrompt}</span>
        </div>
      )}
    </div>
  );
};
