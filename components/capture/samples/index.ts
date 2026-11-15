/**
 * Bundled stand-ins for the camera, offered by the proof screen while the sample-media
 * development flag is on. A cloud simulator has no camera, so these are how the real upload
 * and verify path gets exercised there: three photos that should pass a matching task, one
 * that should fail any task, and one short clip for the video path.
 *
 * The photos are public-domain and CC0 images from Wikimedia Commons; the clip is a slow push
 * in on the gym photo.
 */
import { Asset } from "expo-asset";

export type SampleMedia = {
  key: "gym" | "desk" | "clean_room" | "wrong" | "video";
  label: string;
  mediaType: "photo" | "video";
  /** The bundled asset, as returned by require(). */
  source: number;
  /** Clip length: the verdict screen samples stills across a video and needs to know it. */
  durationMs?: number;
};

export const SAMPLE_MEDIA: SampleMedia[] = [
  { key: "gym", label: "Gym", mediaType: "photo", source: require("./gym.jpg") },
  { key: "desk", label: "Desk", mediaType: "photo", source: require("./desk.jpg") },
  { key: "clean_room", label: "Clean room", mediaType: "photo", source: require("./clean_room.jpg") },
  { key: "wrong", label: "Wrong photo", mediaType: "photo", source: require("./wrong.jpg") },
  { key: "video", label: "Video", mediaType: "video", source: require("./gym_clip.mp4"), durationMs: 4000 },
];

/** Copies a bundled sample to a local file, so it uploads exactly like a camera capture. */
export async function sampleUri(sample: SampleMedia): Promise<string> {
  const asset = Asset.fromModule(sample.source);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}
