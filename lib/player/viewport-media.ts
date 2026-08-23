export type ViewportMediaMode = "live-video" | "fallback-video" | "fallback-image" | "waiting";

type ViewportMediaInput = {
  mode: "live" | "fallback";
  liveStream: boolean;
  liveVideoReady: boolean;
  fallbackAsset: string | null;
};

export function getViewportMediaMode({
  mode,
  liveStream,
  liveVideoReady,
  fallbackAsset,
}: ViewportMediaInput): ViewportMediaMode {
  if (mode === "live") return liveStream && liveVideoReady ? "live-video" : "waiting";
  if (!fallbackAsset) return "waiting";
  return /\.(svg|png|jpe?g|webp)$/i.test(fallbackAsset) ? "fallback-image" : "fallback-video";
}

