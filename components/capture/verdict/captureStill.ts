import { getThumbnailAsync } from "expo-video-thumbnails";

/** A JPEG still of the clip at the given millisecond, as a local file uri. */
export async function captureStill(videoUri: string, timeMs: number): Promise<string> {
  return (await getThumbnailAsync(videoUri, { time: timeMs, quality: 0.6 })).uri;
}
