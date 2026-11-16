/**
 * Bundled stand-ins for the camera, offered by the proof screen while the sample-media
 * development flag is on. A cloud simulator has no camera, so these are how the real upload
 * and verify path gets exercised there: three photos that should pass a matching task, one
 * that should fail any task, three for moments a demo wants to finish live (a call with mom,
 * a quick-time gesture, a group session) and one short clip for the video path.
 *
 * The files are generated images, kept with the rest of the demo media in assets/demo, where
 * manifest.json says what each one shows. The clip is a slow push in on the gym photo.
 */
import { Asset } from "expo-asset";

export type SampleMedia = {
  key: "gym" | "desk" | "clean_room" | "wrong" | "call_mom" | "pushups" | "group" | "video" | "reading" | "screenshot";
  label: string;
  mediaType: "photo" | "video";
  /** The bundled asset, as returned by require(). */
  source: number;
  /** Clip length: the verdict screen samples stills across a video and needs to know it. */
  durationMs?: number;
  /** A timelapse sample: its stills in time order, from one fixed camera. `source` is the first. */
  frames?: number[];
};

const READING_FRAMES = [
  require("../../../assets/demo/samples/reading_1.jpg"),
  require("../../../assets/demo/samples/reading_2.jpg"),
  require("../../../assets/demo/samples/reading_3.jpg"),
  require("../../../assets/demo/samples/reading_4.jpg"),
];

export const SAMPLE_MEDIA: SampleMedia[] = [
  { key: "gym", label: "Gym", mediaType: "photo", source: require("../../../assets/demo/samples/gym.jpg") },
  { key: "desk", label: "Desk", mediaType: "photo", source: require("../../../assets/demo/samples/desk.jpg") },
  {
    key: "clean_room",
    label: "Clean room",
    mediaType: "photo",
    source: require("../../../assets/demo/samples/clean_room.jpg"),
  },
  { key: "wrong", label: "Wrong photo", mediaType: "photo", source: require("../../../assets/demo/samples/wrong.jpg") },
  { key: "call_mom", label: "Call mom", mediaType: "photo", source: require("../../../assets/demo/proofs/call-mom.jpg") },
  // Three fingers up, so it passes only a push-up drop that asks for that gesture.
  {
    key: "pushups",
    label: "Push-ups",
    mediaType: "photo",
    source: require("../../../assets/demo/drops/pushups-maya.jpg"),
  },
  // Four people, for a group session's head count.
  { key: "group", label: "Group", mediaType: "photo", source: require("../../../assets/demo/drops/group-session.jpg") },
  // Four stills of one reading session, which the camera spreads across the task's target as a timelapse.
  { key: "reading", label: "Reading timelapse", mediaType: "photo", source: READING_FRAMES[0], frames: READING_FRAMES },
  // A homework portal's "Submission received" page, for a screenshot task.
  { key: "screenshot", label: "Screenshot", mediaType: "photo", source: require("../../../assets/demo/samples/screenshot.jpg") },
  {
    key: "video",
    label: "Video",
    mediaType: "video",
    source: require("../../../assets/demo/samples/gym_clip.mp4"),
    durationMs: 4000,
  },
];

/** Copies a bundled sample to a local file, so it uploads exactly like a camera capture. */
export async function sampleUri(sample: SampleMedia): Promise<string> {
  const asset = Asset.fromModule(sample.source);
  await asset.downloadAsync();
  return asset.localUri ?? asset.uri;
}
