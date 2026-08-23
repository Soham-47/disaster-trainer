export type CanvasFactory = () => HTMLCanvasElement;

export function captureVideoFrame(
  video: HTMLVideoElement,
  createCanvas: CanvasFactory = () => document.createElement("canvas"),
): string {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    throw new Error("LingBot video is not ready for checkpoint capture.");
  }
  const canvas = createCanvas();
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Checkpoint canvas context is unavailable.");
  context.drawImage(video, 0, 0, 1280, 720);
  const frame = canvas.toDataURL("image/jpeg", 0.82);
  if (!frame.startsWith("data:image/jpeg;base64,") || frame.length < 100) {
    throw new Error("Checkpoint capture was empty.");
  }
  return frame;
}
