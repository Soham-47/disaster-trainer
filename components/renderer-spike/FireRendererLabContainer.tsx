"use client";

import React, { useReducer, useState, useRef, useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { fireSpikeReducer, INITIAL_SPIKE_STATE } from "@/lib/renderer-spike/fire-spike-reducer";
import { audioSynth } from "@/lib/renderer-spike/audio-system";
import { PlayerController } from "./PlayerController";
import { ApartmentScene } from "./ApartmentScene";
import { SpikeUI } from "./SpikeUI";

export function FireRendererLabContainer() {
  const [state, dispatch] = useReducer(fireSpikeReducer, INITIAL_SPIKE_STATE);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [debugColliders, setDebugColliders] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio sync
  useEffect(() => {
    if (state.audioPlaying) {
      audioSynth.playAlarm();
      audioSynth.playCrackle();
      audioSynth.setDoorOpenSound(state.doorOpen);
    }
    return () => {
      audioSynth.stopAll();
    };
  }, [state.audioPlaying, state.doorOpen]);

  const handleLockPointer = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
  }, []);

  // Expose global captureRendererFrame() as specified in Plan.md
  const captureRendererFrame = useCallback((): string => {
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.85);
      dispatch({ type: "SET_CAPTURED_FRAME", dataUrl });
      return dataUrl;
    }
    return "";
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { captureRendererFrame?: () => string }).captureRendererFrame = captureRendererFrame;
    }
  }, [captureRendererFrame]);

  return (
    <div ref={containerRef} className="relative w-screen h-screen bg-black overflow-hidden select-none">
      <Canvas
        ref={(el) => {
          if (el) canvasRef.current = el;
        }}
        gl={{
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          antialias: true,
        }}
        dpr={[1, 1.5]} // Performance Budget requirement in Plan.md
        camera={{ position: [0, 1.7, 1.0], fov: 75, near: 0.1, far: 50 }}
        onClick={handleLockPointer}
      >
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
          <PlayerController
            state={state}
            dispatch={dispatch}
            onTargetChange={setActiveTargetId}
            pointerLocked={pointerLocked}
            setPointerLocked={setPointerLocked}
          />
          <ApartmentScene
            state={state}
            debugColliders={debugColliders}
            activeTarget={activeTargetId}
          />
        </Physics>
      </Canvas>

      <SpikeUI
        state={state}
        dispatch={dispatch}
        activeTargetId={activeTargetId}
        pointerLocked={pointerLocked}
        onLockPointer={handleLockPointer}
        debugColliders={debugColliders}
        setDebugColliders={setDebugColliders}
        onCaptureFrame={captureRendererFrame}
      />
    </div>
  );
}
