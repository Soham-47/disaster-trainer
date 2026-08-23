"use client";

import dynamic from "next/dynamic";

const FireRendererLabContainer = dynamic(
  () =>
    import("@/components/renderer-spike/FireRendererLabContainer").then(
      (mod) => mod.FireRendererLabContainer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-amber-400 font-sans">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h1 className="text-xl font-bold">Loading 3D Renderer Spike...</h1>
        <p className="text-xs text-gray-400 mt-2">Initializing Three.js & Rapier Physics Engine</p>
      </div>
    ),
  }
);

export default function RendererLabPage() {
  return <FireRendererLabContainer />;
}
