"use client";

import React, { useEffect, useRef, useState } from "react";
import { reactorClient, WorldModelStatus } from "@/lib/reactor/client";

interface WorldViewportProps {
  status: WorldModelStatus;
  fallbackAsset?: string;
  capturedFrameUrl?: string | null;
  isRewinding?: boolean;
  onVideoEnd?: () => void;
  className?: string;
  ambientPrompt?: string;
  liveStream?: MediaStream | null;
  mode?: "live" | "fallback";
  onCapturedFrame?: (frameUrl: string) => void;
}

export const WorldViewport: React.FC<WorldViewportProps> = ({
  status,
  fallbackAsset = "/fallbacks/fire-bedroom-orient.mp4",
  capturedFrameUrl,
  isRewinding = false,
  onVideoEnd,
  className = "",
  ambientPrompt = "",
  liveStream,
  mode = "live",
  onCapturedFrame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackVideoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const capturedForPauseRef = useRef<boolean>(false);
  const [localFrameUrl, setLocalFrameUrl] = useState<string | null>(capturedFrameUrl || null);

  useEffect(() => {
    if (capturedFrameUrl) {
      setLocalFrameUrl(capturedFrameUrl);
    } else {
      setLocalFrameUrl(null);
    }
  }, [capturedFrameUrl]);

  // Connect live stream to HTMLVideoElement when liveStream prop changes
  useEffect(() => {
    if (videoRef.current && liveStream) {
      videoRef.current.srcObject = liveStream;
      videoRef.current.play().catch((err) => {
        console.warn("[WorldViewport] Live video play failed:", err);
      });
    }
  }, [liveStream]);

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
  const isUnsafeBranch =
    ambientPrompt.toLowerCase().includes("open") || ambientPrompt.toLowerCase().includes("hallway");
  const isSafeBranch =
    ambientPrompt.toLowerCase().includes("keep door closed") || ambientPrompt.toLowerCase().includes("towel");

  // 60fps Dynamic Atmospheric Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 1280;
    const height = 720;
    canvas.width = width;
    canvas.height = height;

    // Particle arrays
    const smokeParticles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
    }> = [];
    const fireParticles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      color: string;
    }> = [];

    // Initialize smoke
    for (let i = 0; i < 50; i++) {
      smokeParticles.push({
        x: Math.random() * width,
        y: height * 0.4 + Math.random() * (height * 0.6),
        size: 40 + Math.random() * 90,
        speedX: -1 + Math.random() * 2,
        speedY: -0.8 - Math.random() * 1.5,
        opacity: 0.15 + Math.random() * 0.4,
      });
    }

    // Initialize fire particles for unsafe branch
    for (let i = 0; i < 40; i++) {
      fireParticles.push({
        x: width * 0.4 + Math.random() * (width * 0.2),
        y: height * 0.3 + Math.random() * (height * 0.5),
        size: 15 + Math.random() * 35,
        speedY: -2 - Math.random() * 4,
        color: Math.random() > 0.4 ? "#ef4444" : "#f59e0b",
      });
    }

    const startTime = Date.now();

    const render = () => {
      const elapsed = (Date.now() - startTime) / 1000;

      // Base background color
      if (isUnsafeBranch) {
        ctx.fillStyle = "#1c0505"; // Deep fiery red
      } else if (isSafeBranch) {
        ctx.fillStyle = "#030712"; // Deep cool dark blue
      } else {
        ctx.fillStyle = "#0c0a09"; // Dark bedroom
      }
      ctx.fillRect(0, 0, width, height);

      const doorWidth = 240;
      const doorHeight = 480;
      const doorX = (width - doorWidth) / 2;
      const doorY = height - doorHeight - 30;

      // Draw Door Frame
      ctx.fillStyle = isUnsafeBranch ? "#450a0a" : "#262626";
      ctx.fillRect(doorX - 16, doorY - 16, doorWidth + 32, doorHeight + 16);

      if (isUnsafeBranch) {
        // UNSAFE BRANCH: Door is open, raging hallway fire and thick black smoke fill viewport
        const flameGrad = ctx.createLinearGradient(doorX, doorY, doorX + doorWidth, doorY + doorHeight);
        flameGrad.addColorStop(0, "#f97316");
        flameGrad.addColorStop(0.5, "#ef4444");
        flameGrad.addColorStop(1, "#7f1d1d");
        ctx.fillStyle = flameGrad;
        ctx.fillRect(doorX, doorY, doorWidth, doorHeight);

        // Animate Fire Particles in doorway
        fireParticles.forEach((fp) => {
          fp.y += fp.speedY;
          if (fp.y < doorY) {
            fp.y = doorY + doorHeight;
            fp.x = doorX + Math.random() * doorWidth;
          }
          ctx.fillStyle = fp.color;
          ctx.beginPath();
          ctx.arc(fp.x, fp.y, fp.size, 0, Math.PI * 2);
          ctx.fill();
        });

        // Heavy dark smoke overlay filling room
        ctx.fillStyle = "rgba(15, 15, 15, 0.65)";
        ctx.fillRect(0, 0, width, height);
      } else if (isSafeBranch) {
        // SAFE BRANCH: Door closed, wet towel at door gap, cool window safety light
        const doorGrad = ctx.createLinearGradient(doorX, doorY, doorX + doorWidth, doorY + doorHeight);
        doorGrad.addColorStop(0, "#1e293b");
        doorGrad.addColorStop(1, "#0f172a");
        ctx.fillStyle = doorGrad;
        ctx.fillRect(doorX, doorY, doorWidth, doorHeight);

        // Wet towel rolled at door base gap
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.roundRect(doorX - 10, doorY + doorHeight - 12, doorWidth + 20, 18, 8);
        ctx.fill();

        // Safety Label on towel
        ctx.fillStyle = "#38bdf8";
        ctx.font = "11px monospace";
        ctx.fillText("SEALED WITH WET TOWEL", doorX + 35, doorY + doorHeight + 2);

        // Cool Window Light Ray from side
        const windowGrad = ctx.createLinearGradient(width, 0, 0, height);
        windowGrad.addColorStop(0, "rgba(56, 189, 248, 0.25)");
        windowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = windowGrad;
        ctx.fillRect(0, 0, width, height);
      } else {
        // ORIENT / INITIAL STATE: Door closed, warm glow underneath, alarm flashing
        const doorGrad = ctx.createLinearGradient(doorX, doorY, doorX + doorWidth, doorY + doorHeight);
        doorGrad.addColorStop(0, "#171717");
        doorGrad.addColorStop(1, "#0a0a0a");
        ctx.fillStyle = doorGrad;
        ctx.fillRect(doorX, doorY, doorWidth, doorHeight);

        // Door Knob
        ctx.beginPath();
        ctx.arc(doorX + doorWidth - 30, doorY + doorHeight * 0.55, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b"; // Warm door handle
        ctx.fill();

        // Warm Red Heat Glow behind door base gap
        ctx.save();
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 30 + Math.sin(elapsed * 5) * 15;
        ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
        ctx.fillRect(doorX, doorY + doorHeight - 4, doorWidth, 6);
        ctx.restore();
      }

      // Render Drifting Smoke Layer
      smokeParticles.forEach((sp) => {
        sp.x += sp.speedX;
        sp.y += sp.speedY;
        if (sp.y < height * 0.1) {
          sp.y = height - 10;
          sp.x = doorX - 80 + Math.random() * (doorWidth + 160);
        }

        const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.size);
        const colorStr = isUnsafeBranch ? "180, 50, 40" : "120, 113, 108";
        g.addColorStop(0, `rgba(${colorStr}, ${sp.opacity})`);
        g.addColorStop(1, "rgba(20, 20, 20, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Emergency Light Flashing
      const flash = Math.sin(elapsed * 6) > 0.4;
      if (flash && !isSafeBranch) {
        const alarmGrad = ctx.createRadialGradient(
          doorX + doorWidth / 2,
          doorY - 30,
          10,
          doorX + doorWidth / 2,
          doorY - 30,
          600
        );
        alarmGrad.addColorStop(0, "rgba(239, 68, 68, 0.3)");
        alarmGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = alarmGrad;
        ctx.fillRect(0, 0, width, height);

        ctx.beginPath();
        ctx.arc(doorX + doorWidth / 2, doorY - 30, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();
      }

      // Rewind Glitch Effect
      if (isRewinding) {
        ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = "rgba(245, 158, 11, 0.6)";
        ctx.lineWidth = 3;
        const lineY = (elapsed * 1200) % height;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(width, lineY);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [ambientPrompt, status, isRewinding, isUnsafeBranch, isSafeBranch]);

  const showFallbackVideo = mode === "fallback" && Boolean(fallbackAsset);

  return (
    <div
      className={`relative w-full h-full min-h-[480px] bg-neutral-950 overflow-hidden select-none flex items-center justify-center ${className}`}
    >
      {/* Background Radial Gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/70 z-10 pointer-events-none" />

      {/* Live Stream Video Element (WebRTC Track) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 z-10 ${
          mode === "live" && liveStream && (status === "generating" || status === "paused")
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Fallback Prepared Video Element */}
      {showFallbackVideo && (
        <video
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

      {/* Atmospheric World Canvas (Active when no live video stream or during synthetic orient) */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
          showFallbackVideo || (mode === "live" && liveStream)
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
            <img
              src={localFrameUrl}
              alt="Captured Decision Context Frame"
              className={`w-full h-full object-cover ${
                isRewinding ? "scale-105 filter saturate-150 contrast-125 invert-10" : ""
              }`}
            />
          )}
        </div>
      )}

      {/* Rewind Banner */}
      {isRewinding && (
        <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center bg-amber-950/40 backdrop-blur-sm">
          <div className="text-amber-300 font-mono text-xs tracking-widest uppercase mb-2 animate-pulse bg-amber-950/90 px-4 py-1.5 rounded-full border border-amber-500/40 shadow-2xl">
            ↺ Rewinding Time & Context...
          </div>
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
        </div>
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

