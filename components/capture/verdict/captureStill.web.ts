const UNREADABLE = "Couldn't read that video.";

/**
 * expo-video-thumbnails throws on web, which failed every video proof in a browser. The browser
 * can draw the frame itself: seek a detached video element and copy it onto a canvas.
 */
export async function captureStill(videoUri: string, timeMs: number): Promise<string> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error(UNREADABLE));
    video.src = videoUri;
  });
  const lastFrame = Number.isFinite(video.duration) ? Math.max(video.duration - 0.05, 0) : timeMs / 1000;
  await new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new Error(UNREADABLE));
    video.currentTime = Math.min(timeMs / 1000, lastFrame);
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")?.drawImage(video, 0, 0);
  const still = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.6));
  if (still === null) throw new Error(UNREADABLE);
  return URL.createObjectURL(still);
}
